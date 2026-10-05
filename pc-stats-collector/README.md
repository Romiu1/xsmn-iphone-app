# Sổ Đỏ V2.8.1 — Statistics Collector trên PC

Collector nhẹ dùng SQLite, không cần PostgreSQL.

## Chạy Windows
1. Mở thư mục `pc-stats-collector`.
2. Sửa `start.bat`, thay `CHANGE_THIS_TOKEN` bằng một chuỗi bí mật dài.
3. Chạy `start.bat`.
4. Database tự tạo: `stats.sqlite3`.

## Chạy macOS/Linux
Sửa token trong `start.sh`, sau đó chạy `./start.sh`.

## Kết nối Render → PC
Backend V2.8.1 dùng 2 biến môi trường:
- `STATS_COLLECTOR_URL` = URL HTTPS của Collector (không dùng `localhost` trên Render).
- `STATS_COLLECTOR_TOKEN` = đúng token trên PC.

PC cần được truy cập từ Render qua một HTTPS tunnel an toàn (ví dụ Cloudflare Tunnel). Không mở trực tiếp cổng SQLite hay cổng collector ra Internet nếu không có lớp bảo vệ.

## Backup / Restore
- File quan trọng nhất: `stats.sqlite3`.
- Có thể sao chép file này để backup toàn bộ dữ liệu.
- API `/api/backup` xuất JSON sự kiện.
- API `/api/export.csv` xuất CSV.
- API `/api/restore` nhận JSON có dạng `{ "events": [...] }`.

Khuyến nghị backup `stats.sqlite3` định kỳ sang ổ khác/cloud.

## Lưu ý khi PC tắt
Nếu PC tắt hoặc tunnel không hoạt động, Render sẽ không gửi được sự kiện vào SQLite. V2.8.1 vẫn giữ thống kê tạm trên Render; khi cần dữ liệu không mất trong thời gian PC offline dài, nên bổ sung một hàng đợi bền vững ở máy chủ trung gian. Không coi SQLite trên PC là kho online duy nhất khi PC thường xuyên tắt.
