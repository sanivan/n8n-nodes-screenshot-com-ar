import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type INodeExecutionData,
	type INodeProperties,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';

const BASE_URL = 'https://screenshot.com.ar';

// Image formats the API returns: format -> file extension
const EXTENSIONS: Record<string, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };
const imageFormat = (value: unknown) =>
	Object.prototype.hasOwnProperty.call(EXTENSIONS, String(value)) ? String(value) : 'png';

// The API answers in Spanish; the node shows these English messages for the known error codes
const ERRORS: Record<string, string> = {
	missing_key: 'Missing API key',
	invalid_key: 'Invalid API key',
	key_revoked: 'This API key was revoked. Contact hola@screenshot.com.ar',
	invalid_params: 'Invalid parameters (check the URL and the options)',
	host_not_found: 'The domain does not exist',
	dns_error: 'The domain could not be verified (DNS error). Try again in a few minutes',
	render_failed: 'The page could not be loaded (down, too slow, or it blocks browsers)',
	too_large: 'The capture is larger than 10 MB. Use JPEG or WebP, or turn off Full Page',
	quota_exceeded: 'Monthly quota exceeded for your plan',
	browser_limit: 'Free plan: daily browser time used up (2 minutes). It resets at 00:00 UTC',
	busy: 'Temporarily busy. Try again in a few seconds',
};

const captureOptions: INodeProperties[] = [
	{
		displayName: 'Width',
		name: 'width',
		type: 'number',
		typeOptions: { minValue: 320, maxValue: 1920 },
		default: 1280,
		description: 'Viewport width in pixels',
	},
	{
		displayName: 'Height',
		name: 'height',
		type: 'number',
		typeOptions: { minValue: 240, maxValue: 1920 },
		default: 800,
		description: 'Viewport height in pixels',
	},
	{
		displayName: 'Full Page',
		name: 'fullPage',
		type: 'boolean',
		default: false,
		description:
			'Whether to capture the whole scrollable page instead of only the viewport. Pages taller than 10,000 px are cut.',
	},
	{
		displayName: 'Format',
		name: 'format',
		type: 'options',
		options: [
			{ name: 'PNG', value: 'png' },
			{ name: 'JPEG', value: 'jpeg' },
			{ name: 'WebP', value: 'webp' },
		],
		default: 'png',
		description: 'Image format',
	},
	{
		displayName: 'Quality',
		name: 'quality',
		type: 'number',
		typeOptions: { minValue: 10, maxValue: 100 },
		default: 80,
		description: 'Image quality for JPEG and WebP (ignored for PNG)',
	},
	{
		displayName: 'Delay (Ms)',
		name: 'delay',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 5000 },
		default: 0,
		description: 'Extra wait after the page loads, in milliseconds (for animations or late content)',
	},
	{
		displayName: 'Dark Mode',
		name: 'dark',
		type: 'boolean',
		default: false,
		description: 'Whether to ask the page for its dark color scheme (prefers-color-scheme: dark)',
	},
	{
		displayName: 'Cache TTL (Seconds)',
		name: 'cacheTtl',
		type: 'number',
		typeOptions: { minValue: 0, maxValue: 2592000 },
		default: 86400,
		description:
			'How long an identical request is served from cache. Cached results do not use quota. Use 0 to force a fresh capture.',
	},
];

export class ScreenshotComAr implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Screenshot.com.ar',
		name: 'screenshotComAr',
		icon: { light: 'file:../../icons/screenshot.svg', dark: 'file:../../icons/screenshot.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Take screenshots of web pages and read them as clean markdown, rendered in a real browser',
		defaults: {
			name: 'Screenshot.com.ar',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'screenshotComArApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Take Screenshot',
						value: 'screenshot',
						description: 'Capture a web page as an image',
						action: 'Take a screenshot of a web page',
					},
					{
						name: 'Read Page',
						value: 'read',
						description:
							'Get the main content of a web page as markdown, optionally with a screenshot',
						action: 'Read a web page as markdown',
					},
					{
						name: 'Get Usage',
						value: 'usage',
						description: 'Get your plan and the captures used this month (does not use quota)',
						action: 'Get plan and usage',
					},
				],
				default: 'screenshot',
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com',
				description: 'Public web page to open (http or https). Pages behind a login are not supported.',
				displayOptions: { show: { operation: ['screenshot', 'read'] } },
			},
			{
				displayName: 'Put Output File in Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				description: 'Name of the binary field to put the image in',
				displayOptions: { show: { operation: ['screenshot'] } },
			},
			{
				displayName: 'Include Screenshot',
				name: 'includeScreenshot',
				type: 'boolean',
				default: false,
				description:
					'Whether to also return a screenshot (as a binary field) from the same page load',
				displayOptions: { show: { operation: ['read'] } },
			},
			{
				displayName: 'Max Characters',
				name: 'maxChars',
				type: 'number',
				typeOptions: { minValue: 100, maxValue: 200000 },
				default: 50000,
				description: 'Maximum length of the returned markdown',
				displayOptions: { show: { operation: ['read'] } },
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: captureOptions,
				displayOptions: { show: { operation: ['screenshot', 'read'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;

				if (operation === 'usage') {
					const body = await request.call(this, i, '/v1/usage', {}, 'json');
					returnData.push({ json: body.json as IDataObject, pairedItem: { item: i } });
					continue;
				}

				const url = (this.getNodeParameter('url', i) as string).trim();
				if (!url) throw new NodeOperationError(this.getNode(), 'The URL is empty', { itemIndex: i });
				const options = this.getNodeParameter('options', i, {}) as IDataObject;
				const qs: IDataObject = { url, ...captureQuery(options) };

				if (operation === 'screenshot') {
					const res = await request.call(this, i, '/v1/capture', qs, 'arraybuffer');
					const format = imageFormat(options.format ?? 'png');
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const binary = await this.helpers.prepareBinaryData(
						Buffer.from(res.body as ArrayBuffer),
						`screenshot.${EXTENSIONS[format]}`,
						`image/${format}`,
					);
					returnData.push({
						json: {
							url,
							format,
							cache: res.headers['x-cache'] ?? null,
							quotaRemaining: numberOrNull(res.headers['x-quota-remaining']),
							truncated: res.headers['x-truncated'] === 'true',
							pageHeight: numberOrNull(res.headers['x-page-height']),
						},
						binary: { [binaryPropertyName]: binary },
						pairedItem: { item: i },
					});
					continue;
				}

				// read
				const includeScreenshot = this.getNodeParameter('includeScreenshot', i) as boolean;
				qs.screenshot = includeScreenshot;
				qs.max_chars = this.getNodeParameter('maxChars', i) as number;
				const res = await request.call(this, i, '/v1/read', qs, 'json');
				const page = res.json as IDataObject;
				const shot = page.screenshot as IDataObject | null;
				const content: IDataObject = { ...page, cache: res.headers['x-cache'] ?? null };
				delete content.screenshot;
				const item: INodeExecutionData = {
					json: content,
					pairedItem: { item: i },
				};
				if (shot && typeof shot.base64 === 'string') {
					const format = imageFormat(shot.format);
					item.json.screenshotTruncated = shot.truncated === true;
					item.binary = {
						data: await this.helpers.prepareBinaryData(
							Buffer.from(shot.base64, 'base64'),
							`screenshot.${EXTENSIONS[format]}`,
							`image/${format}`,
						),
					};
				}
				returnData.push(item);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// API errors already come as NodeApiError (with the HTTP context); wrap anything else
				const nodeError =
					error instanceof NodeApiError || error instanceof NodeOperationError
						? error
						: // only the message: network errors can carry the request config, headers included
							new NodeOperationError(this.getNode(), (error as Error).message, { itemIndex: i });
				throw nodeError;
			}
		}

		return [returnData];
	}
}

function captureQuery(options: IDataObject): IDataObject {
	const qs: IDataObject = {};
	if (options.width !== undefined) qs.width = options.width;
	if (options.height !== undefined) qs.height = options.height;
	if (options.fullPage) qs.full_page = true;
	if (options.format !== undefined) qs.format = options.format;
	if (options.quality !== undefined) qs.quality = options.quality;
	if (options.delay) qs.delay = options.delay;
	if (options.dark) qs.dark = true;
	if (options.cacheTtl !== undefined) qs.cache_ttl = options.cacheTtl;
	return qs;
}

function numberOrNull(value: string | undefined): number | null {
	if (value === undefined || value === '') return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

interface ApiResponse {
	headers: Record<string, string | undefined>;
	body?: ArrayBuffer;
	json?: unknown;
}

async function request(
	this: IExecuteFunctions,
	itemIndex: number,
	path: string,
	qs: IDataObject,
	as: 'json' | 'arraybuffer',
): Promise<ApiResponse> {
	const options: IHttpRequestOptions = {
		method: 'GET',
		url: `${BASE_URL}${path}`,
		qs,
		encoding: 'arraybuffer',
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		// The API never redirects; not following redirects keeps the X-API-Key header on screenshot.com.ar
		disableFollowRedirect: true,
		timeout: 90000,
	};
	const res = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'screenshotComArApi',
		options,
	)) as { statusCode: number; headers: Record<string, string | undefined>; body: ArrayBuffer };

	const text = () => Buffer.from(res.body).toString('utf8');
	if (res.statusCode < 200 || res.statusCode >= 300) {
		let error: JsonObject = { error: 'http_error', message: `HTTP ${res.statusCode}` };
		try {
			error = JSON.parse(text()) as JsonObject;
		} catch {
			// not JSON (for example, the per-IP rate limit)
		}
		const code = String(error.error ?? res.statusCode);
		throw new NodeApiError(this.getNode(), error, {
			itemIndex,
			httpCode: String(res.statusCode),
			message:
				(Object.prototype.hasOwnProperty.call(ERRORS, code) ? ERRORS[code] : undefined) ??
				(res.statusCode === 429 ? 'Too many requests. Wait a few seconds' : `HTTP ${res.statusCode}`),
			description: `screenshot.com.ar error code: ${code}`,
		});
	}
	return as === 'json'
		? { headers: res.headers, json: JSON.parse(text()) }
		: { headers: res.headers, body: res.body };
}
