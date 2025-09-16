module.exports = async (req, res) => {
  try {
    console.log('=== API Function Invoked ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Cookies:', req.cookies);

    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby6CabeU4XKY5WNiLFrd_IqPSugfeee8hQbc6elAcqIgqK3IWTc5AgW-8VqOF6Z1hSiWA/exec';
    const CLIENT_ID = '342636078901-tgt5o0dhg3icilehe8u26rhm8toiv375.apps.googleusercontent.com';

    if (req.method === 'POST' && req.url.includes('/api/auth/callback')) {
      console.log('Handling OAuth callback with ID token');
      try {
        const { id_token } = req.body;
        if (!id_token) {
          console.error('No ID token provided');
          throw new Error('No ID token provided');
        }
        console.log('Verifying ID token with tokeninfo endpoint');
        const tokenInfoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${id_token}`);
        const tokenInfoText = await tokenInfoResponse.text();
        console.log('Token info response:', tokenInfoText);
        if (!tokenInfoResponse.ok) {
          console.error('Token info fetch failed:', tokenInfoText);
          throw new Error(`Failed to verify ID token: ${tokenInfoText}`);
        }
        let tokenInfo;
        try {
          tokenInfo = JSON.parse(tokenInfoText);
        } catch (e) {
          console.error('JSON parse error for token info:', e.message, tokenInfoText);
          throw new Error(`Invalid JSON from tokeninfo: ${tokenInfoText}`);
        }
        console.log('Token info parsed:', tokenInfo);
        if (tokenInfo.aud !== CLIENT_ID) {
          console.error('Invalid audience in ID token:', tokenInfo.aud);
          throw new Error('Invalid audience in ID token');
        }
        if (!tokenInfo.email_verified) {
          console.error('Email not verified in ID token');
          throw new Error('Email not verified');
        }
        const email = tokenInfo.email?.toLowerCase();
        if (!email) {
          console.error('No email in token info');
          throw new Error('No email found in token info');
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
          console.log('User authorized, setting cookie for email:', email);
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

    if (req.url.includes('/api/auth/check')) {
      console.log('Handling auth check');
      const sessionCookie = req.cookies?.session;
      console.log('Session cookie:', sessionCookie);
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

    if (req.url.includes('/api/auth/signout')) {
      console.log('Handling sign-out');
      try {
        const sessionCookie = req.cookies?.session;
        console.log('Sign-out: Session cookie:', sessionCookie);
        if (sessionCookie) {
          console.log('Clearing authenticatedEmail in Apps Script');
          const logoutResponse = await fetch(`${APPS_SCRIPT_URL}?action=logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: sessionCookie })
          });
          const logoutText = await logoutResponse.text();
          console.log('Apps Script logout response:', logoutText);
          let logoutData;
          try {
            logoutData = JSON.parse(logoutText);
          } catch (e) {
            console.error('JSON parse error for logout response:', e.message, logoutText);
            throw new Error(`Invalid JSON from Apps Script: ${logoutText}`);
          }
          if (logoutData.error) {
            console.error('Apps Script logout error:', logoutData.error);
            throw new Error(logoutData.error);
          }
        }
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
