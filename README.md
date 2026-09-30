# XSMN iPhone V2.5

Bản V2.5 được xây trực tiếp từ V2.4.2.

## Giữ nguyên
- Chọn ngày và đài/tỉnh theo lịch XSMN.
- Kết quả xổ số.
- Phân tích lịch sử 30/60/90/180/365 ngày.
- Tất cả giải / ĐB / G1-G8.
- 5 bộ số tham khảo.
- Lưu riêng bộ số theo ngày + đài + phạm vi giải.
- Đối chiếu tự động và tô xanh số khớp.

## Mới ở V2.5
- Ghi nhận lượt truy cập vào trang chủ.
- Ước tính người truy cập duy nhất theo IP đã băm.
- Ghi nhận mỗi lần phân tích mới.
- Ghi nhận số lần khớp toàn bộ một giải.
- Tính tỷ lệ khớp giải theo phạm vi phân tích.
- Trang **📊 Thống kê hoạt động** ngay trong app.
- Thống kê theo ngày trong 30 ngày gần nhất.

## Công thức tỷ lệ
**Tỷ lệ khớp giải** = số giải được kiểm tra có ít nhất một số cho trùng chính xác toàn bộ / tổng số giải được kiểm tra × 100.

Đây là tỷ lệ quan sát trên dữ liệu mà app đã ghi nhận, không phải xác suất toán học của xổ số.

## Lưu ý triển khai Render
V2.5 lưu thống kê vào `data/stats-db.json`. Nếu dịch vụ Render dùng filesystem tạm thời, dữ liệu thống kê có thể mất khi instance/redeploy thay đổi. Muốn giữ thống kê lâu dài, cần gắn persistent disk hoặc chuyển phần stats sang database bên ngoài.
