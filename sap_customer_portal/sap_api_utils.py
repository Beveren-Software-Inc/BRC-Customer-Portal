import frappe
import re
import requests
import json
import base64
import time
from datetime import datetime, timedelta
from requests.exceptions import RequestException, Timeout, ConnectionError
from urllib.parse import urljoin
from frappe.utils.password import get_decrypted_password
import urllib3

# Suppress SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

MAX_RETRIES = 3
REQUEST_TIMEOUT = 60  # Default timeout for most operations
DASHBOARD_REQUEST_TIMEOUT = 30  # Shorter timeout for dashboard calls to fail faster
RETRY_DELAY = 1

# Cache duration in seconds
# Dashboard/summary data can be cached longer since it's aggregated
DASHBOARD_CACHE_DURATION = 3600  # 60 minutes for dashboard data
# Individual document lists need fresher data
CACHE_DURATION = 900  # 15 minutes for regular data (was 5 minutes)
# Detail views need even fresher data
DETAIL_CACHE_DURATION = 300  # 5 minutes for detail views

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
  
        response = requests.request('POST',
            url=login_url, 
            data=json.dumps(credentials),  
            headers={"Content-Type": "application/json"},
            verify=False,
            timeout=REQUEST_TIMEOUT
        )
        
      
        if response.status_code != 200:
            frappe.log_error(f"Login failed with status {response.status_code}")
            response.raise_for_status()
        
        cookies = response.cookies
        session_id = cookies.get('B1SESSION')
        route_id = cookies.get('ROUTEID')
        
        if not session_id:
            frappe.log_error("SAP B1 login successful but no session ID received", "Customer Portal SAP Integration")
            frappe.throw("Authentication succeeded but session data missing")
            
        return {
            "session_id": session_id,
            "route_id": route_id
        }
    except RequestException as e:
        if retry_count < MAX_RETRIES:
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

def cleanup_sap_session():
    """Cleanup SAP session for current request (optional, frappe.local auto-cleans after request)"""
    if hasattr(frappe.local, 'sap_session'):
        # Optional: Explicitly logout from SAP if needed (for license cleanup)
        # Note: We're not explicitly logging out because sessions in frappe.local
        # are automatically cleaned up after the request completes
        delattr(frappe.local, 'sap_session')
        frappe.logger().debug("[SAP Session] Cleaned up session")

def get_cache_key(customer_code, data_type):
    """Generate cache key for customer data"""
    return f"sap_customer_data_{customer_code}_{data_type}"

def get_cached_data(cache_key, cache_duration=None):
    """Get data from cache if it exists and is not expired
    
    Args:
        cache_key: The cache key to retrieve
        cache_duration: Override cache duration in seconds (defaults to CACHE_DURATION)
    """
    try:
        cached_data = frappe.cache().get_value(cache_key)
        if cached_data:
            cache_time = cached_data.get('timestamp')
            duration = cache_duration if cache_duration is not None else CACHE_DURATION
            if cache_time and datetime.now() - datetime.fromisoformat(cache_time) < timedelta(seconds=duration):
                return cached_data.get('data')
    except Exception as e:
        frappe.logger().warning(f"Cache retrieval error: {str(e)}")
    return None

def set_cached_data(cache_key, data, cache_duration=None):
    """Set data in cache with timestamp
    
    Args:
        cache_key: The cache key to store
        data: The data to cache
        cache_duration: Override cache duration in seconds (defaults to CACHE_DURATION)
    """
    try:
        cache_data = {
            'data': data,
            'timestamp': datetime.now().isoformat()
        }
        duration = cache_duration if cache_duration is not None else CACHE_DURATION
        frappe.cache().set_value(cache_key, cache_data, expires_in_sec=duration)
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
                pass
        
        frappe.logger().info(f"Cleared cache for customer: {customer_code}")
        return True
    except Exception as e:
        frappe.logger().error(f"Error clearing cache for customer {customer_code}: {str(e)}")
        return False

def get_or_create_sap_session():
    """Get or create a reusable SAP session for the current request
    
    Uses frappe.local to store session per request, ensuring thread safety.
    Sessions are reused across multiple API calls within the same request.
    
    Returns:
        dict: Session cookies with 'B1SESSION' and 'ROUTEID', or None on error
    """
    # Use frappe.local to store session per request (thread-safe)
    if not hasattr(frappe.local, 'sap_session'):
        try:
            settings = get_sap_b1_settings()
            if not settings:
                frappe.logger().error("SAP B1 settings not available")
                return None
            
            # Login to SAP
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
                frappe.logger().error("SAP login successful but no session ID received")
                return None
            
            # Store session in frappe.local for reuse
            frappe.local.sap_session = cookies
            frappe.logger().info(f"[SAP Session] Created new session: {session_id[:10]}...")
            return cookies
        except Exception as e:
            frappe.logger().error(f"Error creating SAP session: {str(e)}")
            frappe.log_error(f"SAP session creation error: {str(e)}", "Customer Portal SAP")
            return None
    
    # Return existing session
    frappe.logger().debug("[SAP Session] Reusing existing session")
    return frappe.local.sap_session

def fetch_sap_data_with_session(data_document, params=None, customer_code=None, session_cookies=None, timeout=None):
    """Fetch data from SAP B1 with session management
    
    Args:
        data_document: SAP API endpoint (e.g., 'Invoices', 'Orders')
        params: Query parameters dict
        customer_code: Optional customer code to filter by
        session_cookies: Optional session cookies to reuse (if None, creates or reuses session)
        timeout: Optional timeout in seconds (defaults to REQUEST_TIMEOUT)
    
    Returns:
        dict or list: SAP API response data, or None on error
    """
    try:
        settings = get_sap_b1_settings()
        if not settings:
            frappe.logger().error("SAP B1 settings not available")
            return None
        
        # Use provided session or get/reuse existing session
        if session_cookies is None:
            cookies = get_or_create_sap_session()
            if not cookies:
                return None
        else:
            cookies = session_cookies
        
        # Use provided timeout or default
        request_timeout = timeout if timeout is not None else REQUEST_TIMEOUT
        
        # Build URL
        url = urljoin(settings["server_url"], data_document)
        
        # Normalize params and avoid duplicating CardCode filter
        normalized_params = dict(params or {})
        existing_filter = normalized_params.get('$filter', '') or ''
        if customer_code:
            if 'CardCode' not in existing_filter:
                if existing_filter.strip():
                    normalized_params['$filter'] = f"{existing_filter} and CardCode eq '{customer_code}'"
                else:
                    normalized_params['$filter'] = f"CardCode eq '{customer_code}'"
        
        # GET with cookies and timeout handling
        try:
            response = requests.get(
                url=url,
                params=normalized_params,
                cookies=cookies,
                verify=False,
                timeout=request_timeout
            )
        except Timeout:
            frappe.logger().error(f"SAP API request timeout after {request_timeout}s: {data_document}")
            frappe.log_error(f"SAP API request timeout: {data_document} (timeout: {request_timeout}s)", "Customer Portal SAP Timeout")
            return None
        except ConnectionError as e:
            frappe.logger().error(f"SAP API connection error: {data_document} - {str(e)}")
            frappe.log_error(f"SAP API connection error: {data_document} - {str(e)}", "Customer Portal SAP Connection")
            return None
        
        # If session expired (401), try to create a new session and retry once
        if response.status_code == 401:
            frappe.logger().warning("[SAP Session] Session expired, creating new session")
            if session_cookies is None:  # Only retry if we were using shared session
                # Clear the stored session
                if hasattr(frappe.local, 'sap_session'):
                    delattr(frappe.local, 'sap_session')
                # Try to get a new session
                cookies = get_or_create_sap_session()
                if cookies:
                    # Retry the request with new session (only once, with timeout handling)
                    try:
                        response = requests.get(
                            url=url,
                            params=normalized_params,
                            cookies=cookies,
                            verify=False,
                            timeout=request_timeout
                        )
                    except (Timeout, ConnectionError) as retry_error:
                        frappe.logger().error(f"SAP API retry failed: {data_document} - {str(retry_error)}")
                        return None
        
        if response.status_code != 200:
            frappe.logger().error(f"SAP API request failed: {response.status_code} - {response.text[:200]}")
            return None
        
        data = response.json()
        # Return list for collection responses, or raw dict for entity responses
        if isinstance(data, dict):
            return data.get('value', data)
        return data
        
    except Exception as e:
        frappe.logger().error(f"Error fetching SAP data: {str(e)}")
        frappe.log_error(f"SAP data fetch error: {str(e)}", "Customer Portal SAP")
        return None


def fetch_sap_attachment_binary(attachment_entry, session_cookies=None):
    """Fetch attachment file content from SAP B1 Attachments2(entry)/$value.
    Returns (content_bytes, content_type) or (None, None) on error."""
    if attachment_entry is None or (isinstance(attachment_entry, (int, float)) and int(attachment_entry) <= 0):
        return None, None
    try:
        settings = get_sap_b1_settings()
        if not settings:
            return None, None
        if session_cookies is None:
            cookies = get_or_create_sap_session()
            if not cookies:
                return None, None
        else:
            cookies = session_cookies
        entry = int(attachment_entry)
        url = urljoin(settings["server_url"], f"Attachments2({entry})/$value")
        response = requests.get(url, cookies=cookies, verify=False, timeout=REQUEST_TIMEOUT)
        if response.status_code == 401 and session_cookies is None:
            if hasattr(frappe.local, 'sap_session'):
                delattr(frappe.local, 'sap_session')
            cookies = get_or_create_sap_session()
            if cookies:
                response = requests.get(url, cookies=cookies, verify=False, timeout=REQUEST_TIMEOUT)
        if response.status_code != 200:
            frappe.logger().warning(f"SAP attachment {entry} returned {response.status_code}")
            return None, None
        content = response.content
        content_type = response.headers.get('Content-Type') or 'application/octet-stream'
        return content, content_type
    except Exception as e:
        frappe.logger().error(f"Error fetching SAP attachment {attachment_entry}: {str(e)}")
        return None, None


def get_customer_balance_from_sap(customer_code, session_cookies=None):
    """Fetch customer balance directly from SAP B1"""
    try:
        cache_key = get_cache_key(customer_code, 'balance')
        
        # Check cache first
        cached_data = get_cached_data(cache_key)
        if cached_data:
            frappe.logger().info(f"Returning cached balance data for {customer_code}")
            return cached_data

        # Fetch from SAP
        params = {
            '$select': 'CardCode,CardName,CurrentAccountBalance,CreditLimit,Currency',
            '$filter': f"CardCode eq '{customer_code}'"
        }
        
        data = fetch_sap_data_with_session('BusinessPartners', params, None, session_cookies=session_cookies)
        
        if data and len(data) > 0:
            customer_data = data[0]
            balance_info = {
                'customer_code': customer_data.get('CardCode'),
                'customer_name': customer_data.get('CardName'),
                'current_balance': customer_data.get('CurrentAccountBalance', 0),
                'credit_limit': customer_data.get('CreditLimit', 0),
                'currency': customer_data.get('Currency') or 'SAR'
            }
                        
            # Cache the result
            set_cached_data(cache_key, balance_info)
            return balance_info
        else:
            frappe.logger().warning(f"No data returned from SAP for customer {customer_code}")
            return None
            
    except Exception as e:
        frappe.log_error(f"Error fetching customer balance from SAP: {str(e)}", "Customer Portal SAP")
        return None


def get_customer_orders_from_sap(customer_code, limit=500, session_cookies=None):
    """Fetch customer sales orders from SAP B1 with pagination support"""
    try:
        cache_key = f"orders_{customer_code}_{limit}"
        cached_data = get_cached_data(cache_key)
        if cached_data is not None:
            return cached_data
                
        all_orders = []
        skip = 0
        batch_size = 20
        max_batches = (limit // batch_size) + 1  
        
        for batch_num in range(max_batches):
            params = {
                '$filter': f"CardCode eq '{customer_code}'",
                '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocTotal,DocCurrency,DocumentStatus,NumAtCard',
                '$orderby': 'DocDate desc',
                '$top': batch_size,
                '$skip': skip
            }
            
            data = fetch_sap_data_with_session('Orders', params, None, session_cookies=session_cookies)
            
            if isinstance(data, dict) and 'value' in data:
                batch_data = data['value'] or []
            elif isinstance(data, list):
                batch_data = data
            else:
                batch_data = []
                        
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
                    'status': status,
                    'po_no': order.get('NumAtCard') or '',
                }
                all_orders.append(order_data)
            
            # Check if we've reached the desired limit
            if len(all_orders) >= limit:
                frappe.logger().info(f"[SAP] Reached limit of {limit}, stopping pagination")
                break
            
            # Check if we got fewer records than batch_size (end of data)
            if len(batch_data) < batch_size:
                break
            
            skip += batch_size
        
        # Limit to requested amount
        all_orders = all_orders[:limit]
        
        # Cache the result
        set_cached_data(cache_key, all_orders)
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
            # Get remaining open quantity - this is the pending/undelivered quantity
            # Check if RemainingOpenQuantity exists in the response (not None)
            remaining_open_qty = ln.get('RemainingOpenQuantity')
            if remaining_open_qty is None:
                # Fallback to BaseOpenQuantity if RemainingOpenQuantity is not present
                remaining_open_qty = ln.get('BaseOpenQuantity') or 0
            else:
                remaining_open_qty = remaining_open_qty or 0
            
            pending_qty = remaining_open_qty
            # Calculate delivered quantity: total quantity minus pending quantity
            delivered_qty = qty - pending_qty
            # Ensure delivered_qty is not negative
            delivered_qty = max(0, delivered_qty)
            
            rate = ln.get('UnitPrice') if ln.get('UnitPrice') is not None else (ln.get('PriceAfterVAT') or ln.get('Price') or 0)
            amount = ln.get('LineTotal') if ln.get('LineTotal') is not None else (qty * (rate or 0))
            items.append({
                'item_code': ln.get('ItemCode'),
                'item_name': ln.get('ItemDescription'),
                'description': ln.get('ItemDescription'),
                'qty': qty,
                'delivered_qty': delivered_qty,
                'pending_qty': pending_qty,
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


def _comments_reference_order(comments, order_doc_num):
    """Check if Comments field references the given sales order number.
    SAP format: 'AR SOHAIL Based on Sales Orders 2402647.' or '...Based on Sales Orders 2402647. Based on Deliveries...'
    Uses word boundary to avoid partial matches (e.g. 2402647 vs 24026470)."""
    if not comments or order_doc_num is None:
        return False
    comments_str = str(comments)
    order_str = str(order_doc_num)
    # Match order number as whole word (not part of larger number)
    pattern = r'\b' + re.escape(order_str) + r'\b'
    return bool(re.search(pattern, comments_str))


def get_related_deliveries_for_order(customer_code, order_doc_num, session_cookies=None):
    """Fetch delivery notes linked to a sales order by parsing Comments field.
    Comments format: 'AR SOHAIL Based on Sales Orders 2402647.'
    Returns list of {name, amount, currency} for display on order detail page."""
    try:
        if order_doc_num is None or order_doc_num == '':
            return []
        params = {
            '$filter': f"CardCode eq '{customer_code}'",
            '$select': 'DocNum,DocTotal,DocCurrency,Comments',
            '$orderby': 'DocDate desc',
            '$top': 200,
        }
        data = fetch_sap_data_with_session('DeliveryNotes', params, None, session_cookies=session_cookies)
        if isinstance(data, dict) and 'value' in data:
            batch = data['value'] or []
        elif isinstance(data, list):
            batch = data
        else:
            return []
        result = []
        for dn in batch:
            if _comments_reference_order(dn.get('Comments'), order_doc_num):
                result.append({
                    'name': str(dn.get('DocNum', '')),
                    'amount': dn.get('DocTotal', 0),
                    'currency': dn.get('DocCurrency', '') or 'SAR',
                })
        return result
    except Exception as e:
        frappe.logger().error(f"Error fetching related deliveries for order: {str(e)}")
        return []


def get_related_invoices_for_order(customer_code, order_doc_num, session_cookies=None):
    """Fetch invoices linked to a sales order by parsing Comments field.
    Comments format: 'AR SOHAIL Based on Sales Orders 2402647. Based on Deliveries 24201289.'
    Returns list of {name, amount, currency} for display on order detail page."""
    try:
        if order_doc_num is None or order_doc_num == '':
            return []
        params = {
            '$filter': f"CardCode eq '{customer_code}'",
            '$select': 'DocNum,DocTotal,DocCurrency,Comments',
            '$orderby': 'DocDate desc',
            '$top': 200,
        }
        data = fetch_sap_data_with_session('Invoices', params, None, session_cookies=session_cookies)
        if isinstance(data, dict) and 'value' in data:
            batch = data['value'] or []
        elif isinstance(data, list):
            batch = data
        else:
            return []
        result = []
        for inv in batch:
            if _comments_reference_order(inv.get('Comments'), order_doc_num):
                result.append({
                    'name': str(inv.get('DocNum', '')),
                    'amount': inv.get('DocTotal', 0),
                    'currency': inv.get('DocCurrency', '') or 'SAR',
                })
        return result
    except Exception as e:
        frappe.logger().error(f"Error fetching related invoices for order: {str(e)}")
        return []


def get_customer_delivery_notes_from_sap(customer_code, limit=500, session_cookies=None):
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
                '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocTotal,DocCurrency,DocumentStatus,Comments,NumAtCard,AttachmentEntry',
                '$orderby': 'DocDate desc',
                '$top': batch_size,
                '$skip': skip
            }
            
            frappe.logger().info(f"[SAP] Batch {batch_num + 1} - Delivery notes params: {params}")
            data = fetch_sap_data_with_session('DeliveryNotes', params, None, session_cookies=session_cookies)
            
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
                    'comments': dn.get('Comments', ''),
                    'po_no': dn.get('NumAtCard') or '',
                    'attachment_entry': dn.get('AttachmentEntry'),
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

        # Fetch Returns (Delivery Note Returns) and merge, mark as is_return=1 and negate amounts
        try:
            returns = get_customer_delivery_returns_from_sap(customer_code, limit=limit, session_cookies=session_cookies)
        except Exception:
            returns = []
        merged = (all_delivery_notes or []) + (returns or [])
        
        # Cache the result
        set_cached_data(cache_key, merged)
        frappe.logger().info(f"[SAP] Processed {len(merged)} delivery notes (incl. returns) for customer {customer_code}")
        return merged
    
    except Exception as e:
        frappe.logger().error(f"Error fetching delivery notes from SAP: {str(e)}")
        return []

def get_customer_delivery_returns_from_sap(customer_code, limit=500, session_cookies=None):
    """Fetch delivery returns (SAP Returns entity) and map as negative delivery notes with is_return flag."""
    try:
        cache_key = f"delivery_returns_{customer_code}_{limit}"
        cached_data = get_cached_data(cache_key)
        if cached_data is not None:
            frappe.logger().info(f"[SAP] Returning cached delivery returns: {len(cached_data)} records")
            return cached_data

        frappe.logger().info(f"[SAP] Fetching delivery returns for customer: {customer_code} with limit: {limit}")

        all_returns = []
        skip = 0
        batch_size = 20
        max_batches = (limit // batch_size) + 1

        for batch_num in range(max_batches):
            params = {
                '$filter': f"CardCode eq '{customer_code}'",
                '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocTotal,DocCurrency,DocumentStatus,Comments,NumAtCard,AttachmentEntry',
                '$orderby': 'DocDate desc',
                '$top': batch_size,
                '$skip': skip
            }

            frappe.logger().info(f"[SAP] Batch {batch_num + 1} - Returns params: {params}")
            data = fetch_sap_data_with_session('Returns', params, None, session_cookies=session_cookies)

            if isinstance(data, dict) and 'value' in data:
                batch_data = data['value'] or []
            elif isinstance(data, list):
                batch_data = data
            else:
                batch_data = []

            if not batch_data:
                break

            for rn in batch_data:
                sap_status = rn.get('DocumentStatus')
                status = 'Open' if sap_status == 'bost_Open' else 'Closed' if sap_status == 'bost_Close' else (sap_status or '')

                grand_total = rn.get('DocTotal', 0) or 0
                rn_data = {
                    'name': str(rn.get('DocNum', '')),
                    'sap_doc_entry': rn.get('DocEntry'),
                    'customer': str(rn.get('CardCode', '')),
                    'customer_name': rn.get('CardName', ''),
                    'posting_date': rn.get('DocDate'),
                    'grand_total': -abs(grand_total),
                    'currency': rn.get('DocCurrency', ''),
                    'status': status,
                    'comments': rn.get('Comments', ''),
                    'is_return': 1,
                    'po_no': rn.get('NumAtCard') or '',
                    'attachment_entry': rn.get('AttachmentEntry'),
                }
                all_returns.append(rn_data)

            if len(all_returns) >= limit:
                break

            if len(batch_data) < batch_size:
                break

            skip += batch_size

        all_returns = all_returns[:limit]
        set_cached_data(cache_key, all_returns)
        frappe.logger().info(f"[SAP] Processed {len(all_returns)} delivery returns for customer {customer_code}")
        return all_returns
    except Exception as e:
        frappe.logger().error(f"Error fetching delivery returns from SAP: {str(e)}")
        return []

def get_customer_delivery_note_detail_from_sap(customer_code, doc_num):
    """Fetch a single delivery note with items from SAP B1 by DocNum using $expand (single call with fallback)."""
    try:
        def fetch_with_filter(filter_str: str):
            params = {
                '$filter': filter_str,
                '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocTotal,DocCurrency,DocumentStatus,Comments,DocumentLines,AttachmentEntry',
            }
            data = fetch_sap_data_with_session('DeliveryNotes', params, None)
            if isinstance(data, dict) and 'value' in data:
                return data['value'] or []
            if isinstance(data, list):
                return data
            return []
        # Try DocNum + CardCode first
        delivery_notes = fetch_with_filter(f"DocNum eq {int(doc_num)} and CardCode eq '{customer_code}'")
        if not delivery_notes:
            # Fallback: DocNum only
            delivery_notes = fetch_with_filter(f"DocNum eq {int(doc_num)}")
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
                'delivered_qty': qty,  
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
            'attachment_entry': delivery_note.get('AttachmentEntry'),
        }
    except Exception as e:
        frappe.logger().error(f"Error fetching SAP delivery note detail: {str(e)}")
        return None

def get_customer_invoices_from_sap(customer_code, limit=500, session_cookies=None):
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
                '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocDueDate,DocTotal,DocCurrency,DocumentStatus,Comments,PaidToDate,NumAtCard',
                '$orderby': 'DocDate desc',
                '$top': batch_size,
                '$skip': skip
            }
            
            frappe.logger().info(f"[SAP] Batch {batch_num + 1} - Invoices params: {params}")
            data = fetch_sap_data_with_session('Invoices', params, None, session_cookies=session_cookies)
            
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
                    'comments': inv.get('Comments', ''),
                    'po_no': inv.get('NumAtCard') or '',
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
        
        # Fetch credit notes and merge (credit notes appear as negative invoices with is_return=1)
        try:
            credit_notes = get_customer_credit_notes_from_sap(customer_code, limit=limit, session_cookies=session_cookies)
        except Exception:
            credit_notes = []
        merged = (all_invoices or []) + (credit_notes or [])

        # Cache the result
        set_cached_data(cache_key, merged)
        frappe.logger().info(f"[SAP] Processed {len(merged)} invoices (incl. credit notes) for customer {customer_code}")
        return merged
    
    except Exception as e:
        frappe.logger().error(f"Error fetching invoices from SAP: {str(e)}")
        return []

def get_customer_credit_notes_from_sap(customer_code, limit=500, session_cookies=None):
    """Fetch customer credit notes from SAP B1 and map as negative invoices with is_return flag."""
    try:
        cache_key = f"credit_notes_{customer_code}_{limit}"
        cached_data = get_cached_data(cache_key)
        if cached_data is not None:
            frappe.logger().info(f"[SAP] Returning cached credit notes: {len(cached_data)} records")
            return cached_data

        frappe.logger().info(f"[SAP] Fetching credit notes for customer: {customer_code} with limit: {limit}")

        all_notes = []
        skip = 0
        batch_size = 20
        max_batches = (limit // batch_size) + 1

        for batch_num in range(max_batches):
            params = {
                '$filter': f"CardCode eq '{customer_code}'",
                '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocDueDate,DocTotal,DocCurrency,DocumentStatus,Comments,PaidToDate,NumAtCard',
                '$orderby': 'DocDate desc',
                '$top': batch_size,
                '$skip': skip
            }

            frappe.logger().info(f"[SAP] Batch {batch_num + 1} - CreditNotes params: {params}")
            data = fetch_sap_data_with_session('CreditNotes', params, None, session_cookies=session_cookies)

            if isinstance(data, dict) and 'value' in data:
                batch_data = data['value'] or []
            elif isinstance(data, list):
                batch_data = data
            else:
                batch_data = []

            if not batch_data:
                break

            for cn in batch_data:
                sap_status = cn.get('DocumentStatus')
                status = 'Open' if sap_status == 'bost_Open' else 'Closed' if sap_status == 'bost_Close' else (sap_status or '')

                grand_total = cn.get('DocTotal', 0) or 0
                paid_amount = cn.get('PaidToDate', 0) or 0
                outstanding_amount = grand_total - paid_amount

                note_data = {
                    'name': str(cn.get('DocNum', '')),
                    'sap_doc_entry': cn.get('DocEntry'),
                    'customer': str(cn.get('CardCode', '')),
                    'customer_name': cn.get('CardName', ''),
                    'posting_date': cn.get('DocDate'),
                    'due_date': cn.get('DocDueDate'),
                    # Represent credit note amounts as negative in UI context
                    'grand_total': -abs(grand_total),
                    'outstanding_amount': -abs(outstanding_amount),
                    'paid_amount': paid_amount,  # paid against credit note
                    'currency': cn.get('DocCurrency', ''),
                    'status': status,
                    'comments': cn.get('Comments', ''),
                    'is_return': 1,
                    'po_no': cn.get('NumAtCard') or '',
                }
                all_notes.append(note_data)

            if len(all_notes) >= limit:
                break

            if len(batch_data) < batch_size:
                break

            skip += batch_size

        all_notes = all_notes[:limit]
        set_cached_data(cache_key, all_notes)
        frappe.logger().info(f"[SAP] Processed {len(all_notes)} credit notes for customer {customer_code}")
        return all_notes
    except Exception as e:
        frappe.logger().error(f"Error fetching credit notes from SAP: {str(e)}")
        return []

def get_customer_payments_from_sap(customer_code, limit=500, session_cookies=None):
    """Fetch customer payment entries from SAP B1"""
    try:
        cache_key = f"payments_{customer_code}_{limit}"
        cached_data = get_cached_data(cache_key)
        if cached_data is not None:
            frappe.logger().info(f"[SAP] Returning cached payments: {len(cached_data)} records")
            return cached_data
        
        frappe.logger().info(f"[SAP] Fetching payments for customer: {customer_code} with limit: {limit}")
        
        all_payments = []
        skip = 0
        batch_size = 20  # SAP B1 default limit
        max_batches = (limit // batch_size) + 1  # Prevent infinite loops
        
        for batch_num in range(max_batches):
            # Focus on IncomingPayments as that's where customer payments are stored
            try:
                params = {
                    '$filter': f"CardCode eq '{customer_code}'",
                    '$select': 'DocNum,DocEntry,CardCode,CardName,DocDate,DocCurrency,TransferSum,TransferDate,TransferAccount,TransferReference,JournalRemarks,Remarks,DocType,PaymentType,Cancelled,CancelStatus',
                    '$orderby': 'DocDate desc',
                    '$top': batch_size,
                    '$skip': skip
                }
                
                frappe.logger().info(f"[SAP] Batch {batch_num + 1} - IncomingPayments params: {params}")
                data = fetch_sap_data_with_session('IncomingPayments', params, None, session_cookies=session_cookies)
                
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
                
                # Process payment data
                for payment in batch_data:
                    # Determine status based on Cancelled field
                    cancelled = payment.get('Cancelled', 'tNO')
                    cancel_status = payment.get('CancelStatus', 'csNo')
                    
                    if cancelled == 'tYES' or cancel_status == 'csYes':
                        status = 'Cancelled'
                    else:
                        status = 'Completed'  # IncomingPayments are typically completed when created
                    
                    # Get the payment amount (TransferSum is the actual payment amount)
                    transfer_sum = payment.get('TransferSum', 0)
                    cash_sum = payment.get('CashSum', 0)  # Fallback to cash sum if transfer sum is 0
                    payment_amount = transfer_sum if transfer_sum > 0 else cash_sum
                    
                    payment_data = {
                        'name': str(payment.get('DocNum', '')),
                        'sap_doc_entry': payment.get('DocEntry'),
                        'customer': str(payment.get('CardCode', '')),
                        'customer_name': payment.get('CardName', ''),
                        'posting_date': payment.get('DocDate'),
                        'transfer_date': payment.get('TransferDate'),
                        'amount': payment_amount,
                        'currency': payment.get('DocCurrency', 'SAR'),
                        'status': status,
                        'comments': payment.get('Remarks', ''),
                        'journal_remarks': payment.get('JournalRemarks', ''),
                        'transfer_account': payment.get('TransferAccount', ''),
                        'transfer_reference': payment.get('TransferReference', ''),
                        'doc_type': payment.get('DocType', ''),
                        'payment_type': payment.get('PaymentType', ''),
                        'cancelled': cancelled,
                        'cancel_status': cancel_status
                    }
                    all_payments.append(payment_data)
                
                # Check if we've reached the desired limit
                if len(all_payments) >= limit:
                    frappe.logger().info(f"[SAP] Reached limit of {limit}, stopping pagination")
                    break
                
                # Check if we got fewer records than batch_size (end of data)
                if len(batch_data) < batch_size:
                    frappe.logger().info(f"[SAP] Got {len(batch_data)} records (less than batch size {batch_size}), end of data")
                    break
                
                skip += batch_size
                
            except Exception as e:
                frappe.logger().error(f"[SAP] Error in batch {batch_num + 1}: {str(e)}")
                break
        
        # Limit to requested amount
        all_payments = all_payments[:limit]
        
        # Cache the result
        set_cached_data(cache_key, all_payments)
        frappe.logger().info(f"[SAP] Processed {len(all_payments)} payments for customer {customer_code}")
        return all_payments
        
    except Exception as e:
        frappe.logger().error(f"Error fetching payments from SAP: {str(e)}")
        return []

def get_customer_statement_from_sap(customer_code, from_date, to_date, limit=500):
    """Generate customer statement from SAP invoice and payment data with proper reconciliation"""
    try:
        cache_key = f"customer_statement_{customer_code}_{from_date}_{to_date}_{limit}"
        cached_data = get_cached_data(cache_key)
        if cached_data is not None:
            return cached_data
        
        
        # Step 1: Get all invoices (not just date-filtered ones for proper balance calculation)
        all_invoices = get_customer_invoices_from_sap(customer_code, limit=1000)
        
        # Step 2: Get all payments
        all_payments = get_customer_payments_from_sap(customer_code, limit=1000)
        
        # Step 3: Create combined transaction list
        transactions = []
        
        # Add invoices as debit transactions
        for inv in all_invoices:
            if inv.get('grand_total', 0) > 0:
                transactions.append({
                    'date': inv.get('posting_date'),
                    'document_type': 'Sales Invoice',
                    'document_number': str(inv.get('name', '')),
                    'description': f"Invoice {inv.get('name', '')} - {inv.get('customer_name', '')}",
                    'debit': inv.get('grand_total', 0),
                    'credit': 0,
                    'balance': 0,  # Will be calculated later
                    'currency': inv.get('currency', 'SAR'),
                    'due_date': inv.get('due_date'),
                    'status': inv.get('status', ''),
                    'remarks': inv.get('comments', ''),
                    'outstanding_amount': inv.get('outstanding_amount', 0),
                    'paid_amount': inv.get('paid_amount', 0)
                })
        
        # Add payments as credit transactions
        for payment in all_payments:
            if payment.get('amount', 0) > 0 and payment.get('status') != 'Cancelled':
                transactions.append({
                    'date': payment.get('posting_date'),
                    'document_type': 'Payment',
                    'document_number': str(payment.get('name', '')),
                    'description': f"Payment {payment.get('name', '')} - {payment.get('customer_name', '')}",
                    'debit': 0,
                    'credit': payment.get('amount', 0),
                    'balance': 0,  # Will be calculated later
                    'currency': payment.get('currency', 'SAR'),
                    'due_date': None,
                    'status': payment.get('status', ''),
                    'remarks': payment.get('journal_remarks', ''),
                    'transfer_reference': payment.get('transfer_reference', ''),
                    'transfer_date': payment.get('transfer_date')
                })
        
        # Step 4: Sort all transactions by date
        transactions.sort(key=lambda x: x['date'] if x['date'] else '1900-01-01')
        
        # Step 5: Calculate running balance and filter by date range
        running_balance = 0
        filtered_transactions = []
        opening_balance = 0
        
        for transaction in transactions:
            transaction_date = transaction['date']
            
            running_balance += transaction['debit'] - transaction['credit']
            transaction['balance'] = running_balance
            
            if transaction_date and transaction_date < from_date:
                opening_balance = running_balance
                continue
            
            if transaction_date and from_date <= transaction_date <= to_date:
                filtered_transactions.append(transaction)
        
        # Step 6: Add opening balance transaction if needed
        if opening_balance != 0:
            opening_transaction = {
                'date': from_date,
                'document_type': 'Opening Balance',
                'document_number': 'OPEN',
                'description': f"Opening Balance as of {from_date}",
                'debit': opening_balance if opening_balance > 0 else 0,
                'credit': abs(opening_balance) if opening_balance < 0 else 0,
                'balance': opening_balance,
                'currency': 'SAR',
                'due_date': None,
                'status': 'Balance',
                'remarks': 'Opening balance from previous period'
            }
            filtered_transactions.insert(0, opening_transaction)
        
        # Step 7: Recalculate running balance for filtered transactions
        current_balance = opening_balance
        for transaction in filtered_transactions:
            if transaction['document_type'] != 'Opening Balance':
                current_balance += transaction['debit'] - transaction['credit']
                transaction['balance'] = current_balance
        
        # Step 8: Prepare statement data
        customer_name = all_invoices[0].get('customer_name', '') if all_invoices else (all_payments[0].get('customer_name', '') if all_payments else '')
        
        statement_data = {
            'customer_code': customer_code,
            'customer_name': customer_name,
            'from_date': from_date,
            'to_date': to_date,
            'opening_balance': opening_balance,
            'closing_balance': current_balance,
            'transactions': filtered_transactions,
            'summary': {
                'total_invoices': len([t for t in filtered_transactions if t['document_type'] == 'Sales Invoice']),
                'total_payments': len([t for t in filtered_transactions if t['document_type'] == 'Payment']),
                'total_transactions': len(filtered_transactions),
                'total_invoice_amount': sum(t['debit'] for t in filtered_transactions if t['document_type'] == 'Sales Invoice'),
                'total_payment_amount': sum(t['credit'] for t in filtered_transactions if t['document_type'] == 'Payment')
            }
        }
        
        # Cache the result
        set_cached_data(cache_key, statement_data)
        return statement_data
        
    except Exception as e:
        frappe.logger().error(f"Error generating customer statement from SAP: {str(e)}")
        return None

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

        invoices = fetch_with_filter(f"DocNum eq {int(doc_num)} and CardCode eq '{customer_code}'")
        if not invoices:
            # Fallback: DocNum only
            invoices = fetch_with_filter(f"DocNum eq {int(doc_num)}")
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
        
        # Try to find customer by email if no Portal User mapping
        user_email = frappe.db.get_value("User", current_user, "email")
        if user_email:
            customers_by_email = frappe.get_all("Customer", filters={"email_id": user_email}, pluck="name")
            if customers_by_email:
                return customers_by_email[0]
    except Exception as e:
        frappe.logger().error(f"Error getting customer code for user {current_user}: {str(e)}")
    
    return None


def get_customer_gl_transactions_from_sap(customer_code, from_date, to_date, limit=100000000):
    """Fetch raw GL transactions (OJDT/JDT1) for a specific customer via Service Layer.
    
    Based on the SQL: 
    SELECT c."CardCode", c."CardName", b."BaseRef", b."TransType", b."RefDate", b."LineMemo", b."Debit", b."Credit"
    FROM OJDT a INNER JOIN JDT1 b ON a."TransId" = b."TransId" INNER JOIN OCRD c ON c."CardCode" = b."ShortName"
    WHERE c."CardType" = 'C' AND c."CardCode" = '{customer_code}'
    
    Returns a flat list of GL lines for the specific customer only.
    """
    try:
        cache_key = f"gl_txn_{customer_code}_{from_date}_{to_date}_{limit}"
        cached = get_cached_data(cache_key)
        if cached is not None:
            return cached

        all_lines = []
        skip = 0
        batch_size = 20  # SAP Service Layer default page size
        max_batches = (limit // batch_size) + 1

        # Build params to fetch JournalEntries with their child JournalEntryLines
        # Use $select to include JournalEntryLines instead of $expand
        def build_params():
            return {
                # '$filter': f"ReferenceDate ge '{from_date}' and ReferenceDate le '{to_date}'",
                '$select': 'Number,ReferenceDate,Memo,TransactionCode,JournalEntryLines',
                '$orderby': 'ReferenceDate asc',
                '$top': batch_size,
                '$skip': skip,
            }
        print(f"[GL] Fetching GL transactions for customer {customer_code} from {from_date} to {to_date}")
        print(f"[GL] Batch size: {batch_size}, Max batches: {max_batches}, Limit: {limit}")
        
        # First, let's check the total count
        count_params = {
            '$select': 'Number',
            '$count': 'true'
        }
        print(f"[GL] Checking total count with params: {count_params}")
        count_data = fetch_sap_data_with_session('JournalEntries', count_params, None)
        print(f"[GL] Count result: {count_data}")
        
        for batch_num in range(max_batches):
            params = build_params()
            print(f"[GL] Batch {batch_num + 1} - Query params: {params}")
            data = fetch_sap_data_with_session('JournalEntries', params, None)
            print(f"[GL] Batch {batch_num + 1} - Query result type: {type(data)}")
            
            if data:
                if isinstance(data, dict) and 'value' in data:
                    entries = data['value'] or []
                    print(f"[GL] Batch {batch_num + 1} - Found {len(entries)} journal entries")
                    # Check for next link
                    if '@odata.nextLink' in data:
                        print(f"[GL] Batch {batch_num + 1} - Has next link: {data['@odata.nextLink']}")
                    else:
                        print(f"[GL] Batch {batch_num + 1} - No next link (last page)")
                elif isinstance(data, list):
                    entries = data
                    print(f"[GL] Batch {batch_num + 1} - Found {len(entries)} journal entries (list)")
                else:
                    entries = []
                    print(f"[GL] Batch {batch_num + 1} - No entries found")
            else:
                entries = []
                print(f"[GL] Batch {batch_num + 1} - Data is None")
            
            if not entries:
                print(f"[GL] Batch {batch_num + 1} - No entries, breaking pagination")
                break
            
            # Check if this is the last page (no next link)
            if isinstance(data, dict) and '@odata.nextLink' not in data:
                print(f"[GL] Batch {batch_num + 1} - No next link, this is the last page")
                is_last_page = True
            else:
                is_last_page = False

            for je in entries:
                header_date = je.get('ReferenceDate')
                header_number = je.get('Number')
                header_memo = je.get('Memo', '')
                header_trx_code = je.get('TransactionCode', '')
                lines = je.get('JournalEntryLines') or []
                
                print(f"Processing JE {header_number} with {len(lines)} lines")
                
                for ln in lines:
                    short_name = ln.get('ShortName')
                    print(f"Line ShortName: {short_name}, Looking for: {customer_code}")
                    
                    # Double-check: Only include lines for this specific customer
                    # ShortName in JDT1 = CardCode in OCRD (customer code)
                    if short_name != customer_code:
                        continue
                        
                    print(f"Found matching line for customer {customer_code}")
                    all_lines.append({
                        'date': ln.get('ReferenceDate1') or header_date,
                        'document_type': 'GL',
                        'document_number': header_number,
                        'base_ref': ln.get('Reference1'),
                        'account_code': ln.get('AccountCode'),
                        'debit': ln.get('Debit', 0) or 0,
                        'credit': ln.get('Credit', 0) or 0,
                        'remarks': (ln.get('LineMemo') or header_memo or ''),
                        'transaction_code': header_trx_code,
                        'customer_code': customer_code,  # Add for verification
                    })

            if len(all_lines) >= limit:
                print(f"[GL] Reached limit of {limit} lines, stopping")
                break
            
            # Stop if this is the last page
            if is_last_page:
                print(f"[GL] Reached last page, stopping pagination")
                break
                
            skip += batch_size
            print(f"[GL] Moving to next batch, skip = {skip}")

        all_lines = all_lines[:limit]
        # Sort by date, then by document number, then by base_ref to match SQL ordering
        all_lines.sort(key=lambda x: (
            x.get('date') or '1900-01-01', 
            str(x.get('document_number') or ''), 
            str(x.get('base_ref') or '')
        ))

        set_cached_data(cache_key, all_lines)
        frappe.logger().info(f"[GL] Fetched {len(all_lines)} GL transactions for customer {customer_code}")
        return all_lines
    except Exception as e:
        frappe.logger().error(f"Error fetching GL transactions from SAP for customer {customer_code}: {str(e)}")
        return []


def get_customer_codes_from_user():
    """Return a list of customer codes for the current user.

    Logic:
    - Collect parents from `Portal User` where user == current_user and parenttype == Customer.
    - If none found, fallback to Customer.email_id matching User.email to include all customers sharing same email.
    - Returns empty list if no customers are linked (including admin/system managers without customer links).
    """
    current_user = frappe.session.user
    try:
        portal_customers = frappe.get_all(
            "Portal User",
            filters={"user": current_user, "parenttype": "Customer"},
            pluck="parent"
        )

        if portal_customers:
            return list(dict.fromkeys(portal_customers))

        user_email = frappe.db.get_value("User", current_user, "email")
        if user_email:
            customers_by_email = frappe.get_all("Customer", filters={"email_id": user_email}, pluck="name")
            if customers_by_email:
                return list(dict.fromkeys(customers_by_email))
    except Exception as e:
        frappe.logger().error(f"Error getting customer codes for user {current_user}: {str(e)}")

    # Fallback to single code helper to not break old behavior
    single = get_customer_code_from_user()
    return [single] if single else []
