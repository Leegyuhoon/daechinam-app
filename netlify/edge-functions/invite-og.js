export default async (request, context) => {
  try {
    const response = await context.next();
    const html = await response.text();
    const url = new URL(request.url);
    const exactUrl = `${url.origin}${url.pathname}${url.search}`;
    const shareImageUrl = `${url.origin}/icons/logo-full-trimmed.png`;

    const tags = `
    <meta property="og:url" content="${exactUrl}" />
    <meta property="og:title" content="대신치워주는남자 · 출퇴근 관리" />
    <meta property="og:description" content="여기를 눌러 링크를 확인하세요." />
    <meta property="og:image" content="${shareImageUrl}" />
  </head>`;

    const injected = html.replace("</head>", tags);

    return new Response(injected, {
      status: response.status,
      headers: response.headers,
    });
  } catch (e) {
    return context.next();
  }
};

export const config = {
  path: "/invite/*",
};
