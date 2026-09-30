# XSMN / Vietlott V2.7

V2.7 nâng cấp từ V2.6.

## Thay đổi
- Sửa layout ô Ngày và ô Đài trên iPhone: hai ô cùng kích thước, không lấn nhau.
- Trang Vietlott có thống kê riêng cho từng sản phẩm: Mega 6/45, Power 6/55, Bingo18, Max 3D, Max 3D Pro, Lotto.
- Mỗi sản phẩm thống kê: lượt truy cập, người truy cập duy nhất (IP được băm SHA-256), tổng số lần phân tích, số lần khớp toàn bộ, tỷ lệ khớp giải.
- Thống kê theo từng ngày trong 30 ngày gần nhất.
- Dữ liệu thống kê Vietlott lưu trong `data/vietlott-db.json`.
- Phiên bản thuật toán/phân tích nâng lên V2.7 để không dùng nhầm dữ liệu khóa cũ.

## Render
Giữ nguyên Web Service Render hiện tại. Cập nhật mã nguồn vào repository đang kết nối với Render rồi deploy lại.

Lưu ý: filesystem của Render có thể không bền qua mọi lần deploy/restart tùy cấu hình. Nếu cần thống kê bền vững lâu dài, nên dùng database ngoài.
