import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'
import proxyOptions from './proxyOptions';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		port: 8080,
		host: '0.0.0.0',
		proxy: proxyOptions
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src')
		}
	},
	define: {
		'process.env': {}
	},
	css: {
		// Remove the explicit PostCSS config path to let Vite auto-discover it
		devSourcemap: true,
	},
	build: {
		outDir: '../sap_customer_portal/public/portal',
		emptyOutDir: true,
		target: 'es2015',
		chunkSizeWarningLimit: 3000, 
	},
});
