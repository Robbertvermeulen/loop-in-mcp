import { Layout } from './layout';

export const SignupPage = (props: { error?: string; userCode?: string }) => (
  <Layout title="Sign up">
    <h1>Create your Loop account</h1>
    {props.error && <p class="error">{props.error}</p>}
    <form id="signup-form">
      <label>
        Email
        <input type="email" name="email" required />
      </label>
      <label>
        Name (recipients see this)
        <input type="text" name="displayName" required />
      </label>
      <label>
        Password (min 8 chars)
        <input type="password" name="password" required minlength={8} />
      </label>
      <button type="submit">Sign up</button>
    </form>
    <p class="small">
      Already have an account?{' '}
      <a href={`/login${props.userCode ? `?code=${props.userCode}` : ''}`}>Log in</a>
    </p>
    <script
      dangerouslySetInnerHTML={{
        __html: `
        document.getElementById('signup-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const f = e.target;
          const body = { email: f.email.value, displayName: f.displayName.value, password: f.password.value };
          const res = await fetch('/api/app/signup', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            const next = ${JSON.stringify(props.userCode ? `/device?code=${props.userCode}` : '/').replace(/</g, '\\u003c')};
            window.location.href = next;
          } else {
            const err = await res.json().catch(() => ({}));
            alert((err.error && err.error.message) || 'Signup failed');
          }
        });
      `,
      }}
    />
  </Layout>
);
