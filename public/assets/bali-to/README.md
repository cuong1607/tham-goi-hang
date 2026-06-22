# Thư mục ảnh mẫu thảm Bali To

Đặt ảnh mẫu gốc vào đây theo cấu trúc:

```
public/assets/bali-to/
  BACAU/
    06.jpg    ← hoặc 06.png, 06.webp
    08.jpg
    17.jpg
    ...
  NT/
    02.jpg
    11.jpg
    ...
  NTNEW/
    01.jpg
    ...
  CARO/
    ...
```

## Quy tắc đặt tên file

- Tên file = **pattern** (mã mẫu) + extension
- Hỗ trợ: `.jpg`, `.jpeg`, `.png`, `.webp`
- Hỗ trợ cả `08.jpg` và `8.jpg` (app tự fallback bỏ leading zero)
- Tên thư mục = **GROUP** viết hoa: `BACAU`, `NT`, `NTNEW`, `CARO`, `HD`, ...

## Ví dụ

Để sinh ảnh `BACAU 08`, đặt file ảnh mẫu vào:
```
public/assets/bali-to/BACAU/08.jpg
```

Nếu không có ảnh mẫu, item đó sẽ xuất hiện trong tab "Thiếu ảnh mẫu" và không được render.
