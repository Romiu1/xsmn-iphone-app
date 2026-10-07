# SỔ ĐỎ V2.8.1 — Frontend tách riêng cho GitHub Pages

## Mục tiêu
Frontend chạy độc lập trên GitHub Pages; API vẫn gọi Render qua `config.js`. Không đặt secret của Statistics Collector trong frontend.

## Cài đặt
1. Tạo/ dùng repository GitHub Pages.
2. Xóa frontend cũ trong repo.
3. Giải nén và tải **toàn bộ nội dung của thư mục này** vào thư mục gốc repo, không tải cả thư mục wrapper.
4. Kiểm tra `config.js`: `API_BASE` phải là `https://xsmn-iphone-app.onrender.com`.
5. Bật GitHub Pages → Deploy from branch → branch `main` → folder `/ (root)`.

## Cấu trúc
`index.html`, `vietlott.html`, `config.js`, `sw.js`, `manifest.json`, `assets/`.

Lotto hiển thị **5 số chính 01–35 + 1 số đặc biệt 01–12**.
