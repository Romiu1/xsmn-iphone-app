# XSMN V2 – iPhone/PWA

## Mục tiêu
Mở app → chọn ngày → app tự hiện đúng các đài XSMN → xem kết quả → chọn 30/60/90/180/365 ngày → xem thống kê → xem bộ số tham khảo.

## V2 có
- Dashboard iPhone tối ưu một tay.
- Tự lọc đài theo thứ/ngày.
- Kết quả theo từng giải.
- Thống kê chữ số theo từng vị trí, đếm từ phải sang trái.
- Đầu số / đuôi số.
- Top 2 số cuối / 3 số cuối.
- Bộ số tham khảo tạo từ Top 3 chữ số của từng vị trí.
- Lịch sử 30/60/90/180/365 ngày.
- PWA manifest, có thể thêm vào Home Screen.
- Backend cache dữ liệu để giảm số lần truy cập nguồn.
- Ghi rõ nguồn dữ liệu và giới hạn của thống kê.

## Chạy
Node.js 20+:
npm install
npm start

Mở http://localhost:3000

## Đưa lên iPhone
Deploy lên HTTPS. Trên iPhone mở bằng Safari → Share → Add to Home Screen → Open as Web App.

## Dữ liệu
Nguồn mặc định: SXMN.com.vn. Parser cần bảo trì nếu HTML của nguồn thay đổi.

## Chức năng mua vé
V2 không tự động mua/đặt vé. Nếu bổ sung bước mua, chỉ kết nối dịch vụ bán vé hợp pháp và để người dùng xác nhận giao dịch.
