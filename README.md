# SỔ ĐỎ Frontend V2.8.4

Bản frontend GitHub Pages dùng backend Render hiện tại:
`https://xsmn-iphone-app.onrender.com`

## Có trong V2.8.4
- Max 3D+ là sản phẩm riêng và luôn hiển thị trong trang Vietlott.
- Max 3D+: quay 18:00 Thứ 2, Thứ 4, Thứ 6 (giờ Việt Nam).
- Có nút ⭐ MAX 3D+ và thẻ MAX 3D+ nổi bật.
- Lotto 5/35: 5 số chính 01–35 + 1 số đặc biệt 01–12.
- Giữ Max 3D và Max 3D Pro riêng.
- Service Worker đổi cache version sang V2.8.4 để tránh dùng frontend cũ.
- Logo và icon dùng lại đúng ảnh logo SỔ ĐỎ đã cung cấp, không thay logo mới.

## Upload GitHub Pages
Giải nén và chép **toàn bộ nội dung bên trong** vào root repository, gồm `index.html`, `vietlott.html`, `config.js`, `manifest.json`, `sw.js` và thư mục `assets`. Không đặt trong thư mục con.

Sau khi commit, chờ GitHub Pages deploy. Nếu Safari vẫn giữ bản cũ, đóng Safari hoàn toàn rồi mở lại hoặc xóa dữ liệu website của GitHub Pages một lần để Service Worker nhận cache V2.8.4.


## V2.8.4 – giữ riêng Max 3D và Max 3D+
- Max 3D được giữ lại đầy đủ, không bị thay thế.
- Max 3D+ là một sản phẩm riêng, nằm ngay cạnh Max 3D trong thanh chọn game.
- Có nút mở riêng cho Max 3D và Max 3D+.
- Đã tăng phiên bản service worker để tránh cache giao diện cũ.
