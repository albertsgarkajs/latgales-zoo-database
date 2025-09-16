const fetch = require('node-fetch');

module.exports = async (req, res) => {
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6CabeU4XKY5WNiLFrd_IqPSugfeee8hQbc6elAcqIgqK3IWTc5AgW-8VqOF6Z1hSiWA/exec';
  const CLIENT_ID = '342636078901-tgt5o0dhg3icilehe8u26rhm8toiv375.apps.googleusercontent.com';
  const CLIENT_SECRET = process.env.CLIENT_SECRET; // Store in Vercel environment variables
  const REDIRECT_URI = 'https://latgaleszoodatabase.vercel.app/api/auth/callback';

  // Handle OAuth callback
  if (req.query.code && req.url.includes('/api/auth/callback')) {
    try {
      // Exchange authorization code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: req.query.code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to exchange authorization code');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Get user info
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await userInfoResponse.json();
      const email = userInfo.email?.toLowerCase();

      if (!email) {
        throw new Error('No email found in user info');
      }

      // Verify with Apps Script
      const authResponse = await fetch(`${APPS_SCRIPT_URL}?action=verifyUser&email=${encodeURIComponent(email)}`, {
        method: 'GET'
      });

      const authData = await authResponse.json();
      if (authData.isAuthorized) {
        // Set a session cookie (or use another session mechanism)
        res.setHeader('Set-Cookie', `session=${encodeURIComponent(email)}; Path=/; HttpOnly; Secure; SameSite=Strict`);
        // Redirect to main app
        res.redirect(302, 'https://latgaleszoodatabase.vercel.app/');
      } else {
        res.redirect(302, 'https://latgaleszoodatabase.vercel.app/?error=unauthorized');
      }
    } catch (error) {
      console.error('Auth error:', error);
      res.redirect(302, `https://latgaleszoodatabase.vercel.app/?error=${encodeURIComponent(error.message)}`);
    }
    return;
  }

  // Handle authentication check
  if (req.url.includes('/api/auth/check')) {
    const sessionCookie = req.cookies?.session;
    if (!sessionCookie) {
      return res.status(200).json({ isAuthenticated: false });
    }

    try {
      const authResponse = await fetch(`${APPS_SCRIPT_URL}?action=verifyUser&email=${encodeURIComponent(sessionCookie)}`, {
        method: 'GET'
      });
      const authData = await authResponse.json();
      return res.status(200).json({ isAuthenticated: authData.isAuthorized, email: sessionCookie });
    } catch (error) {
      console.error('Auth check error:', error);
      return res.status(200).json({ isAuthenticated: false, error: error.message });
    }
  }

  // Handle sign-out
  if (req.url.includes('/api/auth/signout')) {
    try {
      await fetch(`${APPS_SCRIPT_URL}?action=logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: req.cookies?.session })
      });
      res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Sign-out error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // Invalid request
  res.status(400).json({ error: 'Invalid request' });
};
