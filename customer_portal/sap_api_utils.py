import frappe
import requests
import json
import base64
import time
from datetime import datetime, timedelta
from requests.exceptions import RequestException
from urllib.parse import urljoin
from frappe.utils.password import get_decrypted_password
import urllib3

# Suppress SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

MAX_RETRIES = 3
REQUEST_TIMEOUT = 60
RETRY_DELAY = 1

# Cache duration in seconds (10 minutes)
CACHE_DURATION = 600

def get_sap_b1_settings():
    """Get SAP B1 settings from the SAP B1 Settings doctype"""
    try:
        settings = frappe.get_single("SAP B1 Settings")
        
        # Try to decrypt password, but handle encryption key issues gracefully
        try:
            password = get_decrypted_password("SAP B1 Settings", "SAP B1 Settings", "password", raise_exception=True)
        except Exception as decrypt_error:
            frappe.logger().error(f"Password decryption failed: {str(decrypt_error)}")
            # Try to get the raw password field (might be unencrypted)
            try:
                password = settings.password
                if not password:
                    raise Exception("No password available")
                frappe.logger().info("Using raw password field (unencrypted)")
            except Exception as raw_error:
                frappe.logger().error(f"Raw password also failed: {str(raw_error)}")
                raise Exception(f"Password decryption failed: {str(decrypt_error)[:100]}")
        
        server_url = f'{settings.server_url}/' if not settings.server_url.endswith('/') else settings.server_url
        
        return {
            "username": settings.username,
            "password": password,
            "companydb": settings.companydb,
            "server_url": server_url
        }
    except Exception as e:
        frappe.log_error(f"Error retrieving SAP B1 settings: {str(e)}", "Customer Portal SAP Integration")
        return None

def create_base64_credentials(username, password, companydb):
    """Create Base64 encoded credentials for SAP B1 Service Layer"""
    credentials = {
        "CompanyDB": companydb,
        "UserName": username,
        "Password": password
    }
    credentials_json = json.dumps(credentials)
    encoded_credentials = base64.b64encode(credentials_json.encode()).decode()
    return encoded_credentials

def login_to_sap_b1(server_url, encoded_credentials, retry_count=0):
    """Login to SAP B1 Service Layer and get session ID"""
    login_url = urljoin(server_url, "Login")
    credentials = json.loads(base64.b64decode(encoded_credentials).decode())
    
    try:
        frappe.logger().info(f"Attempting to login to SAP B1 at: {login_url}")
        frappe.logger().info(f"Credentials: CompanyDB={credentials.get('CompanyDB')}, UserName={credentials.get('UserName')}")
        frappe.logger().info(f"Password length: {len(credentials.get('Password', ''))}")
        
        response = requests.request('POST',
            url=login_url, 
            data=json.dumps(credentials),  
            headers={"Content-Type": "application/json"},
            verify=False,
            timeout=REQUEST_TIMEOUT
        )
        
        frappe.logger().info(f"Login response status: {response.status_code}")
        frappe.logger().info(f"Response headers: {dict(response.headers)}")
        frappe.logger().info(f"Response cookies: {dict(response.cookies)}")
        frappe.logger().info(f"Response content: {response.text[:500]}")
        
        if response.status_code != 200:
            frappe.logger().error(f"Login failed with status {response.status_code}")
            frappe.logger().error(f"Response content: {response.text[:500]}")
            response.raise_for_status()
        
        cookies = response.cookies
        session_id = cookies.get('B1SESSION')
        route_id = cookies.get('ROUTEID')
        
        frappe.logger().info(f"Session ID: {session_id}")
        frappe.logger().info(f"Route ID: {route_id}")
        
        if not session_id:
            frappe.log_error("SAP B1 login successful but no session ID received", "Customer Portal SAP Integration")
            frappe.throw("Authentication succeeded but session data missing")
            
        return {
            "session_id": session_id,
            "route_id": route_id
        }
    except RequestException as e:
        error_msg = f"SAP B1 login failed: {type(e).__name__}"
        frappe.logger().error(f"{error_msg}: {str(e)[:100]}")
        
        if retry_count < MAX_RETRIES:
            frappe.logger().info(f"Retrying login (attempt {retry_count + 1})")
            time.sleep(RETRY_DELAY * (retry_count + 1))
            return login_to_sap_b1(server_url, encoded_credentials, retry_count + 1)
        
        frappe.throw(f"Failed to connect to SAP B1: {str(e)[:100]}")

def get_sap_b1_headers(session_info):
    """Create headers for SAP B1 API requests"""
    return {
        "Content-Type": "application/json",
        "Cookie": f"B1SESSION={session_info['session_id']}; ROUTEID={session_info['route_id']}"
    }

def logout_from_sap_b1(server_url, headers):
    """Logout from SAP B1 Service Layer to release the license"""
    logout_url = urljoin(server_url, "Logout")
    
    try:
        requests.post(logout_url, headers=headers, verify=False, timeout=10)
    except RequestException as e:
        frappe.log_error("SAP B1 logout failed", "Customer Portal SAP Integration")

def get_cache_key(customer_code, data_type):
    """Generate cache key for customer data"""
    return f"sap_customer_data_{customer_code}_{data_type}"

def get_cached_data(cache_key):
    """Get data from cache if it exists and is not expired"""
    try:
        cached_data = frappe.cache().get_value(cache_key)
        if cached_data:
            cache_time = cached_data.get('timestamp')
            if cache_time and datetime.now() - datetime.fromisoformat(cache_time) < timedelta(seconds=CACHE_DURATION):
                return cached_data.get('data')
    except Exception as e:
        frappe.logger().warning(f"Cache retrieval error: {str(e)}")
    return None

def set_cached_data(cache_key, data):
    """Set data in cache with timestamp"""
    try:
        cache_data = {
            'data': data,
            'timestamp': datetime.now().isoformat()
        }
        frappe.cache().set_value(cache_key, cache_data, expires_in_sec=CACHE_DURATION)
    except Exception as e:
        frappe.logger().warning(f"Cache storage error: {str(e)}")

def clear_cache_for_customer(customer_code):
    """Clear all cached data for a specific customer"""
    try:
        # Clear all possible cache keys for this customer
        cache_keys_to_clear = [
            f"sap_customer_data_{customer_code}_delivery_notes_*",
            f"sap_customer_data_{customer_code}_invoices_*", 
            f"sap_customer_data_{customer_code}_orders_*",
            f"sap_customer_data_{customer_code}_balance",
            f"delivery_notes_{customer_code}_*",
            f"invoices_{customer_code}_*",
            f"orders_{customer_code}_*"
        ]
        
        for pattern in cache_keys_to_clear:
            try:
                frappe.cache().delete_keys(pattern)
            except:
                pass  # Ignore errors for individual key patterns
        
        frappe.logger().info(f"Cleared cache for customer: {customer_code}")
        return True
    except Exception as e:
        frappe.logger().error(f"Error clearing cache for customer {customer_code}: {str(e)}")
        return False

def fetch_sap_data_with_session(data_document, params=None, customer_code=None):
    """Fetch data from SAP B1 with session management"""
    try:
        settings = get_sap_b1_settings()
        if not settings:
            frappe.logger().error("SAP B1 settings not available")
            return None
        
        frappe.logger().info(f"Fetching SAP data: {data_document} for customer: {customer_code}")
        
        # Login directly to get cookies (Postman style)
        credentials = {
            "CompanyDB": settings["companydb"],
            "UserName": settings["username"],
            "Password": settings["password"]
        }
        
        login_url = urljoin(settings["server_url"], "Login")
        login_response = requests.post(
            url=login_url,
            json=credentials,
            headers={"Content-Type": "application/json"},
            verify=False,
            timeout=REQUEST_TIMEOUT
        )
        
        if login_response.status_code != 200:
            frappe.logger().error(f"Login failed: {login_response.status_code} - {login_response.text}")
            return None
        
        cookies = login_response.cookies
        session_id = cookies.get('B1SESSION')
        if not session_id:
            frappe.logger().error("No session ID received from login")
            return None
        
        # Build URL
        url = urljoin(settings["server_url"], data_document)
        frappe.logger().info(f"SAP URL: {url}")
        
        # Normalize params and avoid duplicating CardCode filter
        normalized_params = dict(params or {})
        existing_filter = normalized_params.get('$filter', '') or ''
        if customer_code:
            if 'CardCode' not in existing_filter:
                if existing_filter.strip():
                    normalized_params['$filter'] = f"{existing_filter} and CardCode eq '{customer_code}'"
                else:
                    normalized_params['$filter'] = f"CardCode eq '{customer_code}'"
        frappe.logger().info(f"SAP request params: {normalized_params}")
        
        # GET with cookies only (no Content-Type header needed)
        response = requests.get(
            url=url,
            params=normalized_params,
            cookies=cookies,
            verify=False,
            timeout=REQUEST_TIMEOUT
        )
        frappe.logger().info(f"SAP response status: {response.status_code}")
        if response.status_code != 200:
            frappe.logger().error(f"SAP API error: {response.status_code} - {response.text[:500]}")
            return None
        
        data = response.json()
        frappe.logger().info(f"SAP response data keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
        # Return list for collection responses, or raw dict for entity responses
        if isinstance(data, dict):
            return data.get('value', data)
        return data
        
    except Exception as e:
        frappe.logger().error(f"Error fetching SAP data: {str(e)}")
        frappe.log_error(f"SAP data fetch error: {str(e)}", "Customer Portal SAP")
        return None

def get_customer_balance_from_sap(customer_code):
    """Fetch customer balance directly from SAP B1"""
    try:
        cache_key = get_cache_key(customer_code, 'balance')
        
        # Check cache first
        cached_data = get_cached_data(cache_key)
        if cached_data:
            frappe.logger().info(f"Returning cached balance data for {customer_code}")
            return cached_data
        
        frappe.logger().info(f"Fetching balance from SAP for customer: {customer_code}")
        
        # Fetch from SAP
        params = {
            '$select': 'CardCode,CardName,CurrentAccountBalance,CreditLimit',
            '$filter': f"CardCode eq '{customer_code}'"
        }
        
        data = fetch_sap_data_with_session('BusinessPartners', params, None)  # Don't pass customer_code to avoid duplicate filter
        frappe.logger().info(f"SAP response data: {data}")
        frappe.logger().info(f"SAP response data type: {type(data)}")
        frappe.logger().info(f"SAP response data length: {len(data) if data else 'None'}")
        
        if data and len(data) > 0:
            customer_data = data[0]
            balance_info = {
                'customer_code': customer_data.get('CardCode'),
                'customer_name': customer_data.get('CardName'),
                'current_balance': customer_data.get('CurrentAccountBalance', 0),
                'credit_limit': customer_data.get('CreditLimit', 0)
            }
            
            frappe.logger().info(f"Balance info created: {balance_info}")
            
            # Cache the result
            set_cached_data(cache_key, balance_info)
            return balance_info
        else:
            frappe.logger().warning(f"No data returned from SAP for customer {customer_code}")
            return None
            
    except Exception as e:
        frappe.log_error(f"Error fetching customer balance from SAP: {str(e)}", "Customer Portal SAP")
        return None


def get_customer_orders_from_sap(customer_code, limit=100):
    """Fetch customer sales orders from SAP B1 with pagination support"""
    try:
        cache_key = f"orders_{customer_code}_{limit}"
        cached_data = get_cached_data(cache_key)
        if cached_data is not None:
            frappe.logger().info(f"[SAP] Returning cached orders: {len(cached_data)} records")
            return cached_data
        
        frappe.logger().info(f"[SAP] Fetching orders for customer: {customer_code} with limit: {limit}")
        
        all_orders = []
        skip = 0
        batch_size = 20  # SAP B1 default limit
        max_batches = (limit // batch_size) + 1  # Prevent infinite loops
        
        for batch_num in range(max_batches):
            params = {
                '$filter': f"CardCode eq '{customer_code}'",
                '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocTotal,DocCurrency,DocumentStatus',
                '$orderby': 'DocDate desc',
                '$top': batch_size,
                '$skip': skip
            }
            
            frappe.logger().info(f"[SAP] Batch {batch_num + 1} - Orders params: {params}")
            data = fetch_sap_data_with_session('Orders', params, None)
            
            if isinstance(data, dict) and 'value' in data:
                batch_data = data['value'] or []
            elif isinstance(data, list):
                batch_data = data
            else:
                batch_data = []
            
            frappe.logger().info(f"[SAP] Batch {batch_num + 1} - Raw response: {len(batch_data)} records")
            
            if not batch_data:
                frappe.logger().info(f"[SAP] No more data in batch {batch_num + 1}, stopping pagination")
                break
            
            # Process batch data
            for order in batch_data:
                sap_status = order.get('DocumentStatus')
                status = 'Open' if sap_status == 'bost_Open' else 'Closed' if sap_status == 'bost_Close' else (sap_status or '')
                
                order_data = {
                    'name': str(order.get('DocNum', '')),
                    'sap_doc_entry': order.get('DocEntry'),
                    'customer': str(order.get('CardCode', '')),
                    'customer_name': order.get('CardName', ''),
                    'transaction_date': order.get('DocDate'),
                    'grand_total': order.get('DocTotal', 0),
                    'currency': order.get('DocCurrency', ''),
                    'status': status
                }
                all_orders.append(order_data)
            
            # Check if we've reached the desired limit
            if len(all_orders) >= limit:
                frappe.logger().info(f"[SAP] Reached limit of {limit}, stopping pagination")
                break
            
            # Check if we got fewer records than batch_size (end of data)
            if len(batch_data) < batch_size:
                frappe.logger().info(f"[SAP] Got {len(batch_data)} records (less than batch size {batch_size}), end of data")
                break
            
            skip += batch_size
        
        # Limit to requested amount
        all_orders = all_orders[:limit]
        
        # Cache the result
        set_cached_data(cache_key, all_orders)
        frappe.logger().info(f"[SAP] Processed {len(all_orders)} orders for customer {customer_code}")
        return all_orders
    
    except Exception as e:
        frappe.logger().error(f"Error fetching orders from SAP: {str(e)}")
        return []

def get_customer_order_detail_from_sap(customer_code, doc_num):
    """Fetch a single sales order with items from SAP B1 by DocNum using $expand (single call with fallback)."""
    try:
        frappe.logger().info(f"[SAP] Fetching order detail DocNum={doc_num}, CardCode={customer_code}")
        def fetch_with_filter(filter_str: str):
            params = {
                '$filter': filter_str,
                '$select': 'DocNum,DocEntry,CardCode,DocDate,DocTotal,DocCurrency,DocumentStatus,DocumentLines',
            }
            data = fetch_sap_data_with_session('Orders', params, None)
            if isinstance(data, dict) and 'value' in data:
                return data['value'] or []
            if isinstance(data, list):
                return data
            return []
        # Try DocNum + CardCode first
        orders = fetch_with_filter(f"DocNum eq {int(doc_num)} and CardCode eq '{customer_code}'")
        frappe.logger().info(f"[SAP] Orders with DocNum+CardCode: {len(orders)}")
        if not orders:
            # Fallback: DocNum only
            orders = fetch_with_filter(f"DocNum eq {int(doc_num)}")
            frappe.logger().info(f"[SAP] Orders with DocNum only: {len(orders)}")
        if not orders:
            return None
        order = orders[0]
        sap_status = order.get('DocumentStatus')
        status = 'Open' if sap_status == 'bost_Open' else 'Closed' if sap_status == 'bost_Close' else (sap_status or '')
        lines = order.get('DocumentLines') or []
        items = []
        for ln in lines:
            qty = ln.get('Quantity') or 0
            rate = ln.get('UnitPrice') if ln.get('UnitPrice') is not None else (ln.get('PriceAfterVAT') or ln.get('Price') or 0)
            amount = ln.get('LineTotal') if ln.get('LineTotal') is not None else (qty * (rate or 0))
            items.append({
                'item_code': ln.get('ItemCode'),
                'item_name': ln.get('ItemDescription'),
                'description': ln.get('ItemDescription'),
                'qty': qty,
                'delivered_qty': 0,
                'uom': ln.get('UoMCode') or ln.get('MeasureUnit') or '',
                'rate': rate,
                'amount': amount,
            })
        return {
            'name': order.get('DocNum'),
            'sap_doc_entry': order.get('DocEntry'),
            'customer': order.get('CardCode'),
            'transaction_date': order.get('DocDate'),
            'grand_total': order.get('DocTotal', 0),
            'currency': order.get('DocCurrency'),
            'status': status,
            'items': items,
            'total_taxes_and_charges': 0,
        }
    except Exception as e:
        frappe.logger().error(f"Error fetching SAP order detail: {str(e)}")
        return None

def get_customer_delivery_notes_from_sap(customer_code, limit=100):
    """Fetch customer delivery notes from SAP B1 with pagination support"""
    try:
        cache_key = f"delivery_notes_{customer_code}_{limit}"
        cached_data = get_cached_data(cache_key)
        if cached_data is not None:
            frappe.logger().info(f"[SAP] Returning cached delivery notes: {len(cached_data)} records")
            return cached_data
        
        frappe.logger().info(f"[SAP] Fetching delivery notes for customer: {customer_code} with limit: {limit}")
        
        all_delivery_notes = []
        skip = 0
        batch_size = 20  # SAP B1 default limit
        max_batches = (limit // batch_size) + 1  # Prevent infinite loops
        
        for batch_num in range(max_batches):
            params = {
                '$filter': f"CardCode eq '{customer_code}'",
                '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocTotal,DocCurrency,DocumentStatus,Comments',
                '$orderby': 'DocDate desc',
                '$top': batch_size,
                '$skip': skip
            }
            
            frappe.logger().info(f"[SAP] Batch {batch_num + 1} - Delivery notes params: {params}")
            data = fetch_sap_data_with_session('DeliveryNotes', params, None)
            
            if isinstance(data, dict) and 'value' in data:
                batch_data = data['value'] or []
            elif isinstance(data, list):
                batch_data = data
            else:
                batch_data = []
            
            frappe.logger().info(f"[SAP] Batch {batch_num + 1} - Raw response: {len(batch_data)} records")
            
            if not batch_data:
                frappe.logger().info(f"[SAP] No more data in batch {batch_num + 1}, stopping pagination")
                break
            
            # Process batch data
            for dn in batch_data:
                sap_status = dn.get('DocumentStatus')
                status = 'Open' if sap_status == 'bost_Open' else 'Closed' if sap_status == 'bost_Close' else (sap_status or '')
                
                dn_data = {
                    'name': str(dn.get('DocNum', '')),
                    'sap_doc_entry': dn.get('DocEntry'),
                    'customer': str(dn.get('CardCode', '')),
                    'customer_name': dn.get('CardName', ''),
                    'posting_date': dn.get('DocDate'),
                    'grand_total': dn.get('DocTotal', 0),
                    'currency': dn.get('DocCurrency', ''),
                    'status': status,
                    'comments': dn.get('Comments', '')
                }
                all_delivery_notes.append(dn_data)
            
            # Check if we've reached the desired limit
            if len(all_delivery_notes) >= limit:
                frappe.logger().info(f"[SAP] Reached limit of {limit}, stopping pagination")
                break
            
            # Check if we got fewer records than batch_size (end of data)
            if len(batch_data) < batch_size:
                frappe.logger().info(f"[SAP] Got {len(batch_data)} records (less than batch size {batch_size}), end of data")
                break
            
            skip += batch_size
        
        # Limit to requested amount
        all_delivery_notes = all_delivery_notes[:limit]
        
        # Cache the result
        set_cached_data(cache_key, all_delivery_notes)
        frappe.logger().info(f"[SAP] Processed {len(all_delivery_notes)} delivery notes for customer {customer_code}")
        return all_delivery_notes
    
    except Exception as e:
        frappe.logger().error(f"Error fetching delivery notes from SAP: {str(e)}")
        return []

def get_customer_delivery_note_detail_from_sap(customer_code, doc_num):
    """Fetch a single delivery note with items from SAP B1 by DocNum using $expand (single call with fallback)."""
    try:
        frappe.logger().info(f"[SAP] Fetching delivery note detail DocNum={doc_num}, CardCode={customer_code}")
        def fetch_with_filter(filter_str: str):
            params = {
                '$filter': filter_str,
                '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocTotal,DocCurrency,DocumentStatus,Comments,DocumentLines',
            }
            data = fetch_sap_data_with_session('DeliveryNotes', params, None)
            if isinstance(data, dict) and 'value' in data:
                return data['value'] or []
            if isinstance(data, list):
                return data
            return []
        # Try DocNum + CardCode first
        delivery_notes = fetch_with_filter(f"DocNum eq {int(doc_num)} and CardCode eq '{customer_code}'")
        frappe.logger().info(f"[SAP] Delivery notes with DocNum+CardCode: {len(delivery_notes)}")
        if not delivery_notes:
            # Fallback: DocNum only
            delivery_notes = fetch_with_filter(f"DocNum eq {int(doc_num)}")
            frappe.logger().info(f"[SAP] Delivery notes with DocNum only: {len(delivery_notes)}")
        if not delivery_notes:
            return None
        delivery_note = delivery_notes[0]
        sap_status = delivery_note.get('DocumentStatus')
        status = 'Open' if sap_status == 'bost_Open' else 'Closed' if sap_status == 'bost_Close' else (sap_status or '')
        lines = delivery_note.get('DocumentLines') or []
        items = []
        for ln in lines:
            qty = ln.get('Quantity') or 0
            rate = ln.get('UnitPrice') if ln.get('UnitPrice') is not None else (ln.get('PriceAfterVAT') or ln.get('Price') or 0)
            amount = ln.get('LineTotal') if ln.get('LineTotal') is not None else (qty * (rate or 0))
            items.append({
                'item_code': ln.get('ItemCode'),
                'item_name': ln.get('ItemDescription'),
                'description': ln.get('ItemDescription'),
                'qty': qty,
                'delivered_qty': qty,  # For delivery notes, delivered_qty equals qty
                'uom': ln.get('UoMCode') or ln.get('MeasureUnit') or '',
                'rate': rate,
                'amount': amount,
            })
        return {
            'name': str(delivery_note.get('DocNum', '')),
            'sap_doc_entry': delivery_note.get('DocEntry'),
            'customer': str(delivery_note.get('CardCode', '')),
            'customer_name': delivery_note.get('CardName', ''),
            'transaction_date': delivery_note.get('DocDate'),
            'posting_date': delivery_note.get('DocDate'),
            'grand_total': delivery_note.get('DocTotal', 0),
            'currency': delivery_note.get('DocCurrency', ''),
            'status': status,
            'comments': delivery_note.get('Comments', ''),
            'items': items,
            'total_taxes_and_charges': 0,
        }
    except Exception as e:
        frappe.logger().error(f"Error fetching SAP delivery note detail: {str(e)}")
        return None

def get_customer_invoices_from_sap(customer_code, limit=100):
    """Fetch customer invoices from SAP B1 with pagination support"""
    try:
        cache_key = f"invoices_{customer_code}_{limit}"
        cached_data = get_cached_data(cache_key)
        if cached_data is not None:
            frappe.logger().info(f"[SAP] Returning cached invoices: {len(cached_data)} records")
            return cached_data
        
        frappe.logger().info(f"[SAP] Fetching invoices for customer: {customer_code} with limit: {limit}")
        
        all_invoices = []
        skip = 0
        batch_size = 20  # SAP B1 default limit
        max_batches = (limit // batch_size) + 1  # Prevent infinite loops
        
        for batch_num in range(max_batches):
            params = {
                '$filter': f"CardCode eq '{customer_code}'",
                '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocDueDate,DocTotal,DocCurrency,DocumentStatus,Comments,PaidToDate',
                '$orderby': 'DocDate desc',
                '$top': batch_size,
                '$skip': skip
            }
            
            frappe.logger().info(f"[SAP] Batch {batch_num + 1} - Invoices params: {params}")
            data = fetch_sap_data_with_session('Invoices', params, None)
            
            if isinstance(data, dict) and 'value' in data:
                batch_data = data['value'] or []
            elif isinstance(data, list):
                batch_data = data
            else:
                batch_data = []
            
            frappe.logger().info(f"[SAP] Batch {batch_num + 1} - Raw response: {len(batch_data)} records")
            
            if not batch_data:
                frappe.logger().info(f"[SAP] No more data in batch {batch_num + 1}, stopping pagination")
                break
            
            # Process batch data
            for inv in batch_data:
                sap_status = inv.get('DocumentStatus')
                status = 'Open' if sap_status == 'bost_Open' else 'Closed' if sap_status == 'bost_Close' else (sap_status or '')
                
                # Calculate outstanding amount
                grand_total = inv.get('DocTotal', 0)
                paid_amount = inv.get('PaidToDate', 0)
                outstanding_amount = grand_total - paid_amount
                
                inv_data = {
                    'name': str(inv.get('DocNum', '')),
                    'sap_doc_entry': inv.get('DocEntry'),
                    'customer': str(inv.get('CardCode', '')),
                    'customer_name': inv.get('CardName', ''),
                    'posting_date': inv.get('DocDate'),
                    'due_date': inv.get('DocDueDate'),
                    'grand_total': grand_total,
                    'outstanding_amount': outstanding_amount,
                    'paid_amount': paid_amount,
                    'currency': inv.get('DocCurrency', ''),
                    'status': status,
                    'comments': inv.get('Comments', '')
                }
                all_invoices.append(inv_data)
            
            # Check if we've reached the desired limit
            if len(all_invoices) >= limit:
                frappe.logger().info(f"[SAP] Reached limit of {limit}, stopping pagination")
                break
            
            # Check if we got fewer records than batch_size (end of data)
            if len(batch_data) < batch_size:
                frappe.logger().info(f"[SAP] Got {len(batch_data)} records (less than batch size {batch_size}), end of data")
                break
            
            skip += batch_size
        
        # Limit to requested amount
        all_invoices = all_invoices[:limit]
        
        # Cache the result
        set_cached_data(cache_key, all_invoices)
        frappe.logger().info(f"[SAP] Processed {len(all_invoices)} invoices for customer {customer_code}")
        return all_invoices
    
    except Exception as e:
        frappe.logger().error(f"Error fetching invoices from SAP: {str(e)}")
        return []

def get_customer_invoice_detail_from_sap(customer_code, doc_num):
    """Fetch a single invoice with items from SAP B1 by DocNum using $expand (single call with fallback)."""
    try:
        frappe.logger().info(f"[SAP] Fetching invoice detail DocNum={doc_num}, CardCode={customer_code}")
        def fetch_with_filter(filter_str: str):
            params = {
                '$filter': filter_str,
                '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocDueDate,DocTotal,DocCurrency,DocumentStatus,Comments,PaidToDate,DocumentLines',
            }
            data = fetch_sap_data_with_session('Invoices', params, None)
            if isinstance(data, dict) and 'value' in data:
                return data['value'] or []
            if isinstance(data, list):
                return data
            return []
        # Try DocNum + CardCode first
        invoices = fetch_with_filter(f"DocNum eq {int(doc_num)} and CardCode eq '{customer_code}'")
        frappe.logger().info(f"[SAP] Invoices with DocNum+CardCode: {len(invoices)}")
        if not invoices:
            # Fallback: DocNum only
            invoices = fetch_with_filter(f"DocNum eq {int(doc_num)}")
            frappe.logger().info(f"[SAP] Invoices with DocNum only: {len(invoices)}")
        if not invoices:
            return None
        invoice = invoices[0]
        sap_status = invoice.get('DocumentStatus')
        status = 'Open' if sap_status == 'bost_Open' else 'Closed' if sap_status == 'bost_Close' else (sap_status or '')
        
        # Calculate outstanding amount
        grand_total = invoice.get('DocTotal', 0)
        paid_amount = invoice.get('PaidToDate', 0)
        outstanding_amount = grand_total - paid_amount
        
        lines = invoice.get('DocumentLines') or []
        items = []
        for ln in lines:
            qty = ln.get('Quantity') or 0
            rate = ln.get('UnitPrice') if ln.get('UnitPrice') is not None else (ln.get('PriceAfterVAT') or ln.get('Price') or 0)
            amount = ln.get('LineTotal') if ln.get('LineTotal') is not None else (qty * (rate or 0))
            items.append({
                'item_code': ln.get('ItemCode'),
                'item_name': ln.get('ItemDescription'),
                'description': ln.get('ItemDescription'),
                'qty': qty,
                'uom': ln.get('UoMCode') or ln.get('MeasureUnit') or '',
                'rate': rate,
                'amount': amount,
            })
        return {
            'name': str(invoice.get('DocNum', '')),
            'sap_doc_entry': invoice.get('DocEntry'),
            'customer': str(invoice.get('CardCode', '')),
            'customer_name': invoice.get('CardName', ''),
            'posting_date': invoice.get('DocDate'),
            'due_date': invoice.get('DocDueDate'),
            'grand_total': grand_total,
            'outstanding_amount': outstanding_amount,
            'paid_amount': paid_amount,
            'currency': invoice.get('DocCurrency', ''),
            'status': status,
            'comments': invoice.get('Comments', ''),
            'items': items,
            'total_taxes_and_charges': 0,
        }
    except Exception as e:
        frappe.logger().error(f"Error fetching SAP invoice detail: {str(e)}")
        return None

def get_customer_code_from_user():
    """Get customer code for the current user"""
    current_user = frappe.session.user
    
    # Check if user is Administrator or has system roles
    roles = frappe.get_roles(current_user)
    if current_user == "Administrator" or "System Manager" in roles:
        # For admin users, return a default customer code (you might want to make this configurable)
        return "CF342"  # Default customer code as mentioned in the request
    
    # For portal users, get their linked customer
    try:
        portal_users = frappe.get_all(
            "Portal User",
            filters={"user": current_user, "parenttype": "Customer"},
            fields=["parent"]
        )
        
        if portal_users:
            customer_code = portal_users[0].parent
            return customer_code
    except Exception as e:
        frappe.logger().error(f"Error getting customer code for user {current_user}: {str(e)}")
    
    return None
