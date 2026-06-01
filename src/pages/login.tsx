import { Layout } from './layout';

export const LoginPage = (props: { error?: string; userCode?: string }) => (
  <Layout title="Log in">
    <h1>Log in to Loop</h1>
    {props.error && <p class="error">{props.error}</p>}
    <form id="login-form">
      <label>
        Email
        <input type="email" name="email" required />
      </label>
      <label>
        Password
        <input type="password" name="password" required />
      </label>
      <button type="submit">Log in</button>
    </form>
    <p class="small">
      Don't have an account?{' '}
      <a href={`/signup${props.userCode ? `?code=${props.userCode}` : ''}`}>Sign up</a>
    </p>
    <script
      dangerouslySetInnerHTML={{
        __html: `
        document.getElementById('login-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = e.target;
          const body = { email: f.email.value, password: f.password.value };
          const res = await fetch('/api/app/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            const next = ${JSON.stringify(props.userCode ? `/device?code=${props.userCode}` : '/').replace(/</g, '\\u003c')};
            window.location.href = next;
          } else {
            const err = await res.json().catch(() => ({}));
            alert((err.error && err.error.message) || 'Login failed');
          }
        });
      `,
      }}
    />
  </Layout>
);
