FROM public.ecr.aws/docker/library/node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build && npm prune --omit=dev
# RDS の CA 証明書（DBへのTLS接続で接続先を検証するため）
RUN node -e "fetch('https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem').then(r=>{if(!r.ok)throw new Error(r.status);return r.text()}).then(t=>require('fs').writeFileSync('rds-ca.pem',t))"

FROM public.ecr.aws/docker/library/node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/rds-ca.pem ./rds-ca.pem
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
