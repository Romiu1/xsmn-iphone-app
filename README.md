# XSMN iPhone App V2.8.1

Nâng cấp trực tiếp từ V2.8, chưa tách frontend tĩnh.

## Thay đổi V2.8.1
- Giữ nguyên frontend/Render architecture của V2.8.
- Thêm Statistics Collector chạy trên PC bằng SQLite.
- Backend có thể gửi sự kiện lượt truy cập/phân tích sang PC qua `STATS_COLLECTOR_URL` + `STATS_COLLECTOR_TOKEN`.
- API thống kê sẽ ưu tiên dữ liệu PC khi Collector kết nối được; nếu không sẽ dùng dữ liệu cục bộ hiện có của backend.
- Collector có backup JSON, export CSV, restore và file `stats.sqlite3` để sao lưu.
- Thêm Vietlott **Max 3D+**, lịch quay 18:00 Thứ 2/4/6 (giờ Việt Nam).
- Lotto được thể hiện đúng **5 số chính 01–35 + 1 số đặc biệt 01–12**; phần đặc biệt được phân tích riêng.

## Biến môi trường Render
```text
STATS_COLLECTOR_URL=https://<URL-HTTPS-COLLECTOR>
STATS_COLLECTOR_TOKEN=<TOKEN-GIỐNG-PC>
```

Không dùng `http://localhost:8787` trên Render. PC phải có HTTPS endpoint/tunnel để Render gọi tới.

## Backup
Kho chính trên PC: `pc-stats-collector/stats.sqlite3`.
Nên copy file này định kỳ sang ổ đĩa khác. Khi chuyển database sau này, có thể xuất JSON/CSV hoặc dùng SQLite làm nguồn migration.

## Vietlott
- Max 3D+: 18:00 Thứ 2, 4, 6.
- Max 3D Pro: 18:00 Thứ 3, 5, 7.
- Lotto: 5 số chính + 1 số đặc biệt.
- Các mô hình “lồng cầu/HRNG” trong app chỉ là mô phỏng phần mềm; không điều khiển thiết bị quay vật lý.
