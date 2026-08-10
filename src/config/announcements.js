// ── Konfigurasi Pengumuman Situs ─────────────────────────────────────
// Edit HANYA file ini untuk mengubah isi pengumuman.
// Pengumuman tampil di SEMUA halaman (dipasang di __root.tsx) dan
// TIDAK BISA ditutup/dihapus oleh pengunjung.
//
// Field:
//   id      : wajib, unik.
//   active  : true/false — matikan tanpa hapus baris.
//   type    : 'warning' | 'info' | 'success' | 'error'
//   title   : judul singkat (boleh '').
//   message : isi pesan.
//   linkText: teks link opsional.
//   linkTo  : route internal ("/search") atau URL luar (https://...).

export const ANNOUNCEMENTS = [
  {
    id: "server-down",
    active: true,
    type: "warning",
    title: "Jika salah satu server streaming tidak bisa diakses",
    message:
      "Silahkan pindah ke server lain melalui pilihan server di halaman nonton.",
    linkText: "",
    linkTo: "",
  },
  // {
  //   id: "update-fitur",
  //   active: false,
  //   type: "info",
  //   title: "Fitur baru",
  //   message: "Komik berwarna sekarang sudah bisa dibaca di halaman Komik.",
  //   linkText: "Buka Komik",
  //   linkTo: "/komik",
  // },
];

export default ANNOUNCEMENTS;
