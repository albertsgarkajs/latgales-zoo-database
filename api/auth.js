module.exports = async (req, res) => {
  try {
    console.log('=== API Function Invoked ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Cookies:', req.cookies);
    const CLIENT_ID = '342636078901-tgt5o0dhg3icilehe8u26rhm8toiv375.apps.googleusercontent.com';

    if (req.method === 'POST' && req.url.includes('/api/auth/callback')) {
      console.log('Handling OAuth callback');
      try {
        const { id_token } = req.body;
        if (!id_token) {
          console.error('No ID token provided');
          return res.status(400).json({ error: 'No ID token provided' });
        }
        console.log('Verifying ID token');
        const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`);
        if (!tokenInfoResponse.ok) {
          const errorText = await tokenInfoResponse.text();
          console.error('Token info fetch failed:', errorText);
          return res.status(400).json({ error: `Failed to verify ID token: ${errorText}` });
        }
        const tokenInfo = await tokenInfoResponse.json();
        console.log('Token info:', tokenInfo);
        if (tokenInfo.aud !== CLIENT_ID) {
          console.error('Invalid audience:', tokenInfo.aud);
          return res.status(400).json({ error: 'Invalid audience in ID token' });
        }
        if (!tokenInfo.email_verified || !tokenInfo.email) {
          console.error('Email not verified or missing');
          return res.status(400).json({ error: 'Email not verified or missing' });
        }
        const email = tokenInfo.email.toLowerCase();
        console.log('Setting session cookie for email:', email);
        res.setHeader('Set-Cookie', `session=${encodeURIComponent(email)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`);
        return res.status(200).json({ success: true, email });
      } catch (error) {
        console.error('OAuth callback error:', error.message);
        return res.status(500).json({ error: `OAuth callback failed: ${error.message}` });
      }
    }

    if (req.url.includes('/api/auth/check')) {
      console.log('Handling auth check');
      try {
        const sessionCookie = req.cookies?.session || '';
        console.log('Session cookie:', sessionCookie);
        if (!sessionCookie) {
          console.log('No session cookie');
          return res.status(200).json({ isAuthenticated: false });
        }
        const email = decodeURIComponent(sessionCookie);
        console.log('Authenticated email:', email);
        if (!email) {
          console.log('Invalid session cookie');
          return res.status(200).json({ isAuthenticated: false });
        }
        return res.status(200).json({ isAuthenticated: true, email });
      } catch (error) {
        console.error('Auth check error:', error.message);
        return res.status(500).json({ error: `Auth check failed: ${error.message}` });
      }
    }

    if (req.url.includes('/api/auth/signout')) {
      console.log('Handling sign-out');
      try {
        res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Sign-out error:', error.message);
        return res.status(500).json({ error: `Sign-out failed: ${error.message}` });
      }
    }

    console.log('Invalid request');
    return res.status(400).json({ error: 'Invalid request' });
  } catch (error) {
    console.error('Uncaught error in auth.js:', error.message, error.stack);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
};
