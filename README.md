# metapage-tools

Công cụ tự host để quản lý **Facebook Page**: lên lịch nội dung, comment/reply qua [Pages API](https://developers.facebook.com/docs/pages-api/) (hợp lệ, không dùng bot Group).

- Repo: [quankmksnb/metapage-tools](https://github.com/quankmksnb/metapage-tools)
- Bối cảnh chi tiết: [docs/CONTEXT.md](./docs/CONTEXT.md)
- Kế hoạch triển khai: [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)

## Cấu trúc

```
apps/api     # API + worker (Fastify, TypeScript)
apps/web     # Admin UI (sau)
docs/        # Planning & Meta setup
```

## Bắt đầu nhanh

```bash
cp .env.example .env
npm install
npm run dev
```

Mở `http://localhost:3000/health`.

## Biến môi trường

Xem [.env.example](./.env.example) và [docs/META_SETUP.md](./docs/META_SETUP.md).

## Roadmap

- [ ] OAuth Meta + lưu Page token
- [ ] Scheduler posts / comments
- [ ] Webhooks + auto-reply rules
- [ ] Admin UI

## License

Private / tùy chủ repo.
