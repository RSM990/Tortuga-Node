exports.getTest = (req, res, next) => {
  res.status(200).json({
    message: 'Test route succeeded!!!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
};
