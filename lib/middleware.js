function requireAuth(req, res, next) {
  if (!req.session.userId) {
    const nextUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${nextUrl}`);
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    const nextUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`/login?next=${nextUrl}`);
  }
  if (!res.locals.currentUser || res.locals.currentUser.role !== 'admin') {
    return res.status(403).render('403');
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
