import React from 'react';
import ReactDOM from 'react-dom/client';

import {App} from './ui/App';
import {StoreProvider} from './store';

import './ui/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<StoreProvider>
			<App />
		</StoreProvider>
	</React.StrictMode>
);
