# กฎลับ (Secret Rule)

เกมปาร์ตี้ไขกฎลับ เล่นกับเพื่อน 3–7 คน — ทีวีเป็นโต๊ะกลางและคนตัดสิน มือถือแต่ละคนเป็นไพ่ในมือ

- Spec สำหรับพัฒนา: [`SPEC.md`](SPEC.md)
- คำแนะนำสำหรับ Claude Code: [`CLAUDE.md`](CLAUDE.md)

## วิธีเล่น (เมื่อสร้างเสร็จ)

1. เปิด `table.html` บนโน้ตบุ๊กที่ต่อทีวี → สร้างห้อง
2. เพื่อนสแกน QR บนทีวีด้วยมือถือ → ใส่ชื่อ
3. กด "เริ่มเกม"

## Hosting

GitHub Pages → Settings → Pages → Deploy from branch `main` / root

## Supabase

ตั้งค่าแล้ว: project `secret-rule` (Tokyo) และตาราง `rooms` ตาม SQL ใน `SPEC.md` §7 ถูกสร้างแล้ว ค่า URL กับ publishable key อยู่ใน `config.js` (key นี้ออกแบบมาให้เปิดเผยใน browser ได้)
