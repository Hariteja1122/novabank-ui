# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# production (real backend) or mock (in-browser demo data)
ARG BUILD_CONFIGURATION=production
RUN npx ng build --configuration ${BUILD_CONFIGURATION}

# ---- serve ----
FROM nginx:1.27-alpine
ENV API_GATEWAY_URL=http://api-gateway:8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
RUN rm -f /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/novabank-ui/browser /usr/share/nginx/html
EXPOSE 8080
