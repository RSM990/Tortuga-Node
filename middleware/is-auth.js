const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET || 'somesupersecretsecret'
    );
    req.userId = decodedToken.userId; // or 'id' depending on how you sign it
    next();
  } catch (err) {
    console.error('JWT Error:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
