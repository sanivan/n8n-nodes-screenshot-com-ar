import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ScreenshotComArApi implements ICredentialType {
	name = 'screenshotComArApi';

	displayName = 'Screenshot.com.ar API';

	icon: Icon = { light: 'file:../icons/screenshot.svg', dark: 'file:../icons/screenshot.dark.svg' };

	documentationUrl = 'https://github.com/sanivan/n8n-nodes-screenshot-com-ar#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your API key (starts with sk_). Get one for free at https://screenshot.com.ar, or see it in My account.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	// GET /v1/usage validates the key without using quota
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://screenshot.com.ar',
			url: '/v1/usage',
			method: 'GET',
			disableFollowRedirect: true,
		},
	};
}
