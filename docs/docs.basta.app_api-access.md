---
url: "https://docs.basta.app/api-access"
title: "API Access"
---

[![logo](https://image-forwarder.notaku.so/aHR0cHM6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL25vdGFrdS11c2VyLWltYWdlcy8yZmIxMTM4Mi1mNWU0LTRiYzgtODVhZi01ZTdkYWJiOGI2MjBCYXN0YSUyNTIwRmlsbGVkJTI1NDAzeC5wbmc=)](https://docs.basta.app/)

[Home Page](https://basta.app/)

Search

CtrlK

[👋 Welcome](https://docs.basta.app/)

[🚀\\
\\
Getting Started with Basta](https://docs.basta.app/getting-started-with-basta)

[🔓\\
\\
API Access](https://docs.basta.app/api-access)

[☁️\\
\\
API Overview](https://docs.basta.app/api-overview)

[👣\\
\\
Walkthroughs](https://docs.basta.app/walkthroughs)

[📝\\
\\
Glossary](https://docs.basta.app/glossary)

[![](https://image-forwarder.notaku.so/aHR0cHM6Ly93d3cubm90aW9uLnNvL2ltYWdlL2h0dHBzJTNBJTJGJTJGcHJvZC1maWxlcy1zZWN1cmUuczMudXMtd2VzdC0yLmFtYXpvbmF3cy5jb20lMkY0ZmMxNzUzYy0yYWVlLTRiYzEtYmNhMC1hN2JlZGJiZmU5NWUlMkZmYmIwZTQzMy00ZjY4LTRiYmYtODI4Zi0xYzAyMzUxNzViODclMkZCYXN0YS1wYWNrYWdlLWxvZ28xLnN2Zz90YWJsZT1ibG9jayZpZD0xMWU4OGE0MC1mODU0LTQ0ZDctYTIxMy00MTdhYzRjOTNjMGUmY2FjaGU9djImd2lkdGg9MjAw)\\
\\
SDKs](https://docs.basta.app/sdks)

[🪝\\
\\
Webhooks](https://docs.basta.app/webhooks)

[👋 Welcome](https://docs.basta.app/)

# API Access

## 📝 Step 1: Sign Up & Log In

1. Create your user account at [dashboard.basta.app](https://dashboard.basta.app/)

2. You’ll receive your **Account ID** once your business account is activated

3. Log into the [dashboard](https://dashboard.basta.app/) to create an API key

> 📬 If you haven’t received your Account ID yet, contact us at hi@basta.app

## 🔑 Step 2: Generate an API Key

Once logged in, navigate to your dashboard’s **Settings** section to generate an api key.

You’ll use this key to authenticate your GraphQL requests.

## 🧾 Step 3: Set Request Headers

All requests to the **[Management API](https://management.api.basta.app/)** must include these headers:

```
json
{
  "x-account-id": "YOUR_ACCOUNT_ID",
  "x-api-key": "YOUR_API_KEY"
}
```

> ✅ These headers are required for both authenticated queries and mutations.

[Getting Started with Basta](https://docs.basta.app/getting-started-with-basta)

[API Overview](https://docs.basta.app/api-overview)

* * *

Powered by[Notaku](https://notaku.so/)

Helpful?

Share

[share on twitter](https://twitter.com/intent/tweet?text=API+Access%0Ahttps%3A%2F%2Fdocs.basta.app%2Fapi-access)[share on facebook](https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fdocs.basta.app%2Fapi-access)[share on linkedin](https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fdocs.basta.app%2Fapi-access)

Content

[API Access](https://docs.basta.app/api-access#ca1c0b6df9d9444f98e922248866f517)

[📝 Step 1: Sign Up & Log In](https://docs.basta.app/api-access#241123f55f7d80a98267c5289927e7ab)

[🔑 Step 2: Generate an API Key](https://docs.basta.app/api-access#241123f55f7d80218ebec49b42488e3a)

[🧾 Step 3: Set Request Headers](https://docs.basta.app/api-access#241123f55f7d800a8ee7fc0915e368af)