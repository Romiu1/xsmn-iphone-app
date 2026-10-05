# SỔ ĐỎ – Frontend GitHub Pages V2.8.1 Max 3D+ / Lotto 5/35

Bản frontend tĩnh dùng với backend Render hiện tại:
`https://xsmn-iphone-app.onrender.com`

## Đã có
- Max 3D+ riêng, lịch quay 18:00 Thứ 2, Thứ 4, Thứ 6 (giờ Việt Nam).
- Lotto 5/35: 5 số chính 01–35 + 1 số đặc biệt 01–12.
- Thống kê riêng từng sản phẩm, gồm Max 3D+ và Lotto 5/35.
- Frontend tĩnh chạy trên GitHub Pages.
- `config.js` chứa API backend Render.
- Service Worker đã đổi cache version để tránh giữ bản frontend cũ.

## Cài lên GitHub Pages
Giải nén ZIP và đưa **toàn bộ nội dung bên trong** lên thư mục gốc của repository Pages. Không đưa cả thư mục ZIP làm một thư mục con.

Cấu trúc gốc:
```
assets/
config.js
index.html
manifest.json
sw.js
vietlott.html
```

Không cần tạo Render Web Service mới.
