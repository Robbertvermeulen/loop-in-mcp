import type { FC, PropsWithChildren } from 'hono/jsx';

export const Layout: FC<PropsWithChildren<{ title: string }>> = (props) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{props.title} — Loop</title>
      <style>{`
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          background: #FAF7F2;
          color: #15171D;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        main { width: 100%; max-width: 28rem; padding: 2rem; }
        h1 { font-size: 1.5rem; margin: 0 0 1.5rem; }
        label { display: block; margin-bottom: 1rem; font-size: 0.875rem; }
        input[type=email], input[type=password], input[type=text] {
          width: 100%; padding: 0.625rem 0.75rem; margin-top: 0.25rem;
          border: 1px solid #15171D; background: transparent; font-size: 1rem;
          border-radius: 2px;
        }
        button {
          width: 100%; padding: 0.75rem 1rem; background: #B8552B; color: #FAF7F2;
          border: 0; border-radius: 2px; font-size: 1rem; font-weight: 500; cursor: pointer;
        }
        button:hover { background: #8E4322; }
        .small { font-size: 0.875rem; color: #6B6259; margin-top: 1rem; }
        .error { color: #B8552B; margin: 1rem 0; }
        a { color: #B8552B; }
      `}</style>
    </head>
    <body>
      <main>{props.children}</main>
    </body>
  </html>
);
