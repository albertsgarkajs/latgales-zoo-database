module.exports = async (req, res) => {
  try {
    console.log('=== API Function Invoked ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('CLIENT_SECRET available:', !!process.env.CLIENT_SECRET ? 'Yes' : 'No - This could cause failure');

    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6CabeU4XKY5WNiLFrd_IqPSugfeee8hQbc6elAcqIgqK3IWTc5AgW-8VqOF6Z1hSiWA/exec';
    const CLIENT_ID = '342636078901-tgt5o0dhg3icilehe8u26rhm8toiv375.apps.googleusercontent.com';
    const CLIENT_SECRET = process.env.CLIENT_SECRET;

    if (!CLIENT_SECRET) {
      console.error('CLIENT_SECRET is missing');
      return res.status(500).json({ error: 'Missing CLIENT_SECRET environment variable' });
    }

    // Handle OAuth callback with ID token
    if (req.method === 'POST' && req.url.includes('/api/auth/callback')) {
      console.log('Handling OAuth callback with ID token');
      try {
        const { id_token } = req.body;
        if (!id_token) {
          console.error('No ID token provided');
          throw new Error('No ID token provided');
        }

        // Verify the ID token with Google's API
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${id_token}` }
        });
        if (!userInfoResponse.ok) {
          const errorText = await userInfoResponse.text();
          console.error('User info fetch failed:', errorText);
          throw new Error(`Failed to fetch user info: ${errorText}`);
        }

        const userInfo = await userInfoResponse.json();
        const email = userInfo.email?.toLowerCase();
        if (!email) {
          console.error('No email in user info');
          throw new Error('No email found in user info');
        }

        console.log('Verifying user with Apps Script:', email);
        const authResponse = await fetch(`${APPS_SCRIPT_URL}?action=verifyUser&email=${encodeURIComponent(email)}`, {
          method: 'GET'
        });
        const authText = await authResponse.text();
        console.log('Apps Script verifyUser response:', authText);
        let authData;
        try {
          authData = JSON.parse(authText);
        } catch (e) {
          console.error('JSON parse error for auth response:', e.message, authText);
          throw new Error(`Invalid JSON from Apps Script: ${authText}`);
        }
        if (authData.error) {
          console.error('Apps Script error:', authData.error);
          throw new Error(authData.error);
        }

        if (authData.isAuthorized) {
          console.log('User authorized, setting cookie');
          res.setHeader('Set-Cookie', `session=${encodeURIComponent(email)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`);
          return res.status(200).json({ success: true, email });
        } else {
          console.log('User not authorized');
          return res.status(401).json({ error: 'User not authorized' });
        }
      } catch (error) {
        console.error('OAuth callback error:', error.message);
        return res.status(500).json({ error: error.message });
      }
    }

    // Handle authentication check
    if (req.url.includes('/api/auth/check')) {
      console.log('Handling auth check');
      const sessionCookie = req.cookies?.session;
      if (!sessionCookie) {
        console.log('No session cookie, returning false');
        return res.status(200).json({ isAuthenticated: false });
      }
      try {
        console.log('Verifying session with Apps Script:', sessionCookie);
        const authResponse = await fetch(`${APPS_SCRIPT_URL}?action=verifyUser&email=${encodeURIComponent(sessionCookie)}`, {
          method: 'GET'
        });
        const authText = await authResponse.text();
        console.log('Apps Script auth check response:', authText);
        let authData;
        try {
          authData = JSON.parse(authText);
        } catch (e) {
          console.error('JSON parse error for auth check:', e.message, authText);
          throw new Error(`Invalid JSON from Apps Script: ${authText}`);
        }
        if (authData.error) {
          console.error('Apps Script auth check error:', authData.error);
          throw new Error(authData.error);
        }
        console.log('Auth check result:', authData.isAuthorized);
        return res.status(200).json({ isAuthenticated: authData.isAuthorized, email: sessionCookie });
      } catch (error) {
        console.error('Auth check error:', error.message);
        return res.status(500).json({ isAuthenticated: false, error: error.message });
      }
    }

    // Handle sign-out
    if (req.url.includes('/api/auth/signout')) {
      console.log('Handling sign-out');
      try {
        await fetch(`${APPS_SCRIPT_URL}?action=logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: req.cookies?.session })
        });
        res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Sign-out error:', error.message);
        return res.status(500).json({ error: error.message });
      }
    }

    console.log('Invalid request, returning 400');
    res.status(400).json({ error: 'Invalid request' });
  } catch (error) {
    console.error('Uncaught error in api/auth.js:', error.message, error.stack);
    res.status(500).json({ error: 'Internal server error in function' });
  }
};
