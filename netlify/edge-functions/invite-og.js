export default async (request, context) => {
  const response = await context.next();
  const html = await response.text();
  const url = new URL(request.url);
  const exactUrl = `${url.origin}${url.pathname}${url.search}`;
  const shareImageUrl = `${url.origin}/icons/og-share.jpg`;

  const tags = `
    <meta property="og:url" content="${exactUrl}" />
    <meta property="og:title" content="대신치워주는남자 · 출퇴근 관리 연결 링크" />
    <meta property="og:description" content="본인 전용 연결 링크입니다. 눌러서 앱에 자동으로 연결하세요." />
    <meta property="og:image" content="${shareImageUrl}" />
  </head>`;

  const injected = html.replace("</head>", tags);

  return new Response(injected, {
    status: response.status,
    headers: response.headers,
  });
};

export const config = {
  path: "/invite/*",
};
