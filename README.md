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


## V2.1 - Đối chiếu số cho
- Giữ nguyên hệ thống lấy và hiển thị kết quả của V2.
- Người dùng nhập một hoặc nhiều "số cho" cách nhau bằng dấu phẩy.
- Đối chiếu chính xác từng số với từng kết quả đang hiển thị, không đảo thứ tự và không đổi vị trí chữ số.
- Nếu trùng chính xác, số kết quả được bôi nền đen nhưng vẫn nhìn rõ số.
- Có thông báo tổng số kết quả trùng và giải tương ứng.
- Không sử dụng cơ chế cào kết quả riêng của V4.

## V2.1 behavior
- Each client IP can execute historical analysis once per server process. Subsequent requests reuse the saved analysis set.
- The analysis-generated numbers are automatically compared with the result panel; no manual number input is required.
- Exact full-string and same-order matches are highlighted with black background while the digits remain visible.


## V2.3 changes
- The History Analysis panel remains visible and is restored after reopening the app.
- Analysis results are stored in iPhone/browser localStorage for the selected date + station + prize.
- Server quota: 1 IP / 1 analysis / 1 prize / 1 day.
- The stored analysis numbers automatically compare against the currently displayed lottery results.
- Exact matches are highlighted with a green background while keeping the digits visible.
- No manual number-entry field is used.
