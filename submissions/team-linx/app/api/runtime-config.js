module.exports = (_request, response) => {
  const config = {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
  };

  response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.status(200).send(
    `window.ENV_SUPABASE_URL=${JSON.stringify(config.url)};window.ENV_SUPABASE_ANON_KEY=${JSON.stringify(config.anonKey)};window.ENV_USE_LIVE_BACKEND=${Boolean(config.url && config.anonKey)};`,
  );
};
