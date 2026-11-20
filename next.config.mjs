/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // EdgeOne 以 OpenNext 方式部署时，非 NEXT_PUBLIC_ 前缀的服务端变量在运行时
  // 常常无法注入到 process.env（线上诊断确认 SUPABASE_SERVICE_ROLE_KEY 为空）。
  // 构建阶段把这几个密钥内联进"仅服务端"bundle：构建环境持有这些变量，
  // 客户端 bundle 不经过此处理，因此密钥不会下发到浏览器，避免泄露。
  webpack: (config, { isServer, webpack }) => {
    if (isServer) {
      const keys = ["SUPABASE_SERVICE_ROLE_KEY", "BANGUMI_UA", "ADMIN_USERNAME"];
      const definitions = {};
      for (const key of keys) {
        if (process.env[key] !== undefined) {
          definitions[`process.env.${key}`] = JSON.stringify(process.env[key]);
        }
      }
      if (Object.keys(definitions).length && webpack) {
        config.plugins.push(new webpack.DefinePlugin(definitions));
      }
    }
    return config;
  },
};

export default nextConfig;
