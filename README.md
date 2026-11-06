# n8n-nodes-screenshot-com-ar

This is an n8n community node for [screenshot.com.ar](https://screenshot.com.ar). It takes screenshots of any public web page and reads pages as clean markdown, rendered in a real Chrome browser (JavaScript included).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

- [Installation](#installation)
- [Operations](#operations)
- [Credentials](#credentials)
- [Usage](#usage)
- [Example workflows](#example-workflows)
- [Limits and errors](#limits-and-errors)
- [Compatibility](#compatibility)
- [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The package name is `n8n-nodes-screenshot-com-ar`.

## Operations

| Operation | What it returns |
|---|---|
| **Take Screenshot** | The page as an image (PNG, JPEG or WebP) in a binary field, plus `cache`, `quotaRemaining`, `truncated` and `pageHeight`. |
| **Read Page** | The page's main content as markdown (without navigation, footers, ads or cookie banners), with `title`, `description`, `truncated` and `captured_at`. Optionally, a screenshot from the same page load in the binary field `data`. |
| **Get Usage** | Your plan and the captures used this month: `plan`, `month`, `monthly_limit`, `used`, `remaining`. Does not use quota. |

Options for Take Screenshot and Read Page: width, height, full page (up to 10,000 px tall), format, quality, delay, dark mode and cache TTL.

The node can also be used as a tool by n8n AI agents, so an agent can read or look at web pages. Keep in mind that page content is untrusted: a page can contain text written to manipulate an AI agent (prompt injection), and every capture an agent requests uses your quota.

## Credentials

1. Create a free account at [screenshot.com.ar](https://screenshot.com.ar/#clave) (100 captures per month, no credit card). You get an API key that starts with `sk_`. You can also see it, or generate a new one, in [My account](https://screenshot.com.ar/panel).
2. In n8n, create a **Screenshot.com.ar API** credential and paste the key.

n8n checks the key with `GET /v1/usage`, which does not use quota. The key is sent in the `X-API-Key` header.

## Usage

- **URL**: any public `http` or `https` page. Pages behind a login, and private or internal addresses, are not supported.
- **Cache**: identical requests within the cache TTL (24 hours by default) are served from cache and **do not use quota**. Set **Cache TTL** to `0` to force a fresh capture.
- **Full page**: pages taller than 10,000 px are cut; the output has `truncated: true` and the real `pageHeight`.
- **Binary output**: Take Screenshot puts the image in the field set in **Put Output File in Field** (`data` by default). Connect it to nodes such as Google Drive, Slack, Send Email or Write Binary File.
- **Read Page for AI**: the markdown output is compact and ready to pass to an LLM node. Use **Max Characters** to limit its length.

## Example workflows

**Daily screenshot of a competitor's home page to Google Drive**

1. Schedule Trigger: every day at 8:00.
2. Screenshot.com.ar → Take Screenshot, URL `https://competitor.example`, Options → Full Page on, Format JPEG.
3. Google Drive → Upload File, input binary field `data`, file name `competitor-{{ $now.toFormat('yyyy-MM-dd') }}.jpg`.

**Alert when a page's text changes**

1. Schedule Trigger: once a day.
2. Screenshot.com.ar → Read Page, URL of the page to watch, Options → Cache TTL `3600`.
3. Compare the `markdown` field with the last stored version (for example, in a Google Sheets row or with the Compare Datasets node).
4. If it changed, send the differences to Slack, Telegram or email, and store the new version.

**Summarize any link with AI**

1. Webhook or Chat Trigger with a URL.
2. Screenshot.com.ar → Read Page.
3. An LLM node (OpenAI, Anthropic, etc.) with the prompt "Summarize this page: {{ $json.markdown }}".

## Limits and errors

| Plan | Captures per month |
|---|---|
| Free | 100 (plus a 2-minute daily browser-time cap) |
| Pro | 5,000 |
| Business | 25,000 |

Paid plans are billed in Argentine pesos. See [pricing](https://screenshot.com.ar/#precios).

Errors include the screenshot.com.ar error code in the description, for example `quota_exceeded`, `render_failed` (the page could not be loaded), `host_not_found` or `browser_limit`. The full list is in the [API documentation](https://screenshot.com.ar/docs#errores). Turn on **Continue On Fail** to get the error in the item instead of stopping the workflow.

## Compatibility

Built with `@n8n/node-cli` 0.55 for current n8n versions (it uses the node features of recent n8n releases, such as AI tool support). It has no runtime dependencies. If it does not load in your n8n version, please open an issue.

## Resources

- [screenshot.com.ar API documentation](https://screenshot.com.ar/docs) (Spanish) and [llms.txt](https://screenshot.com.ar/llms.txt) (English)
- [OpenAPI spec](https://screenshot.com.ar/openapi.json)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- Support: hola@screenshot.com.ar
