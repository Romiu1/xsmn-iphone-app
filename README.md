# XSMN iPhone V2.4

Bản V2.4 được xây dựng trực tiếp từ XSMN V2 gốc, giữ nguyên lựa chọn ngày, đài/tỉnh, số ngày 30/60/90/180/365, phạm vi giải và phần Kết quả/Phân tích lịch sử.

## Bổ sung V2.4
- Lưu bộ phân tích lịch sử để đóng/mở lại app vẫn hiển thị đúng bộ số cũ.
- Mỗi IP + ngày + đài/tỉnh + phạm vi giải chỉ tạo một lần phân tích; lần sau dùng lại kết quả đã lưu.
- Không yêu cầu nhập số thủ công.
- Tự động lấy các bộ số được tạo trong "Bộ số tham khảo" để đối chiếu với chính kết quả xổ số đang hiển thị.
- Nếu số phân tích xuất hiện liên tiếp đúng thứ tự trong kết quả, phần số trùng được tô nền xanh.
- Giữ nguyên danh sách đài/tỉnh và lịch XSMN của V2 gốc.

## Chạy
```bash
npm install
npm start
```

Mở `http://localhost:3000`.

## Render
Có thể dùng lại Web Service Render hiện có của V2. Chỉ cần cập nhật mã nguồn/đẩy phiên bản V2.4 lên repository mà Render đang theo dõi; không cần tạo lại Web Service.
