import { Layout } from './layout';

export const DevicePage = (props: {
  code?: string;
  loggedIn: boolean;
  message?: string;
  success?: boolean;
}) => (
  <Layout title="Connect a device">
    <h1>{props.success ? 'Connected!' : 'Connect Claude Code to Loop'}</h1>
    {props.success ? (
      <p>You can close this tab and return to Claude Code. The connection should complete in a few seconds.</p>
    ) : (
      <>
        {props.message && <p class="error">{props.message}</p>}
        {!props.loggedIn ? (
          <>
            <p>You need to sign in or sign up to approve this device.</p>
            <p>
              <a href={`/signup${props.code ? `?code=${props.code}` : ''}`}>Create an account</a>
              {' · '}
              <a href={`/login${props.code ? `?code=${props.code}` : ''}`}>Log in</a>
            </p>
          </>
        ) : (
          <form id="approve-form">
            <p>You're approving:</p>
            <label>
              Device code
              <input
                type="text"
                name="userCode"
                required
                value={props.code ?? ''}
                pattern="[A-Z0-9]{4}-[A-Z0-9]{4}"
              />
            </label>
            <button type="submit">Approve</button>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                document.getElementById('approve-form').addEventListener('submit', async (e) => {
                  e.preventDefault();
                  const f = e.target;
                  const res = await fetch('/api/device/approve', {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ userCode: f.userCode.value.toUpperCase() }),
                  });
                  if (res.ok) {
                    window.location.search = '?approved=1';
                  } else {
                    const err = await res.json().catch(() => ({}));
                    alert((err.error && err.error.message) || 'Approval failed');
                  }
                });
              `,
              }}
            />
          </form>
        )}
      </>
    )}
  </Layout>
);
