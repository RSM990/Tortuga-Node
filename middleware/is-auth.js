const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const cookie = req.get('Cookie');

  if (!cookie) {
    const error = new Error('Not authenticated.');
    error.statusCode = 401;
    return res.status(200).json({ message: 'Not authenticated', data: null });
  }
  const token = cookie.split('=')[1];
  // const token = authHeader.split(' ')[1];
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, 'somesupersecretsecret');
  } catch (err) {
    err.statusCode = 500;
    throw err;
  }
  if (!decodedToken) {
    const error = new Error('Not authenticated.');
    error.statusCode = 401;
    return res.status(200).json({ message: 'Not authenticated', data: null });
  }
  req.userId = decodedToken.userId;
  next();
};
