import React from 'react';
import ReactDOM from 'react-dom/client';

import {initAI} from './ai/provider';
import {App} from './ui/App';
import {StoreProvider} from './store';

import {applyEditorScheme, readEditorScheme} from './ui/editorScheme';

import './ui/app.css';

applyEditorScheme(readEditorScheme());
initAI();

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<StoreProvider>
			<App />
		</StoreProvider>
	</React.StrictMode>
);
