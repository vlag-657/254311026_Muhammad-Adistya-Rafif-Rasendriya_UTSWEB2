<?php

namespace App\Http\Controllers;

use App\Models\review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * ForumController  (sisi user & admin)
 *
 * Endpoint:
 *  GET  /forum/postingan                  (user, admin) — §10.1  KF-03
 *  POST /forum/postingan                  (user, admin) — §10.2  KF-03
 *  GET  /forum/postingan/{id}             (user, admin) — §10.3  KF-03
 *  GET  /forum/postingan/{id}/balasan     (user, admin) — §10.4  KF-03
 *  POST /forum/postingan/{id}/balasan     (user, admin) — §10.5  KF-03
 */
class ReviewController extends Controller
{
    // ─────────────────────────────────────────────
    // §10.1  GET /forum/postingan
    // q mencari: judul
    // sort: tanggal (default -tanggal)
    // ─────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $params = $this->paginasiParams($request);
        if ($params === null) {
            return $this->errorValidasi([
                'page'  => ['Nilai page harus >= 1'],
                'limit' => ['Nilai limit harus antara 1 dan 50'],
            ]);
        }

        $validator = Validator::make($request->query(), [
            'q'    => 'nullable|string|max:100',
            'sort' => 'nullable|string|in:tanggal,-tanggal',
        ]);
        if ($validator->fails()) {
            return $this->errorValidasi($validator->errors()->toArray());
        }

        $sort  = $request->query('sort', '-tanggal');
        $query = Review::with('penulis')->withCount('review user');

        if ($request->filled('q')) {
            $query->where('judul', 'like', '%' . $request->q . '%');
        }

        $query->orderBy('created_at', str_starts_with($sort, '-') ? 'desc' : 'asc');

        $paginator = $query->paginate($params['limit'], ['*'], 'page', $params['page']);

        $data = $paginator->getCollection()->map(fn ($p) => $this->formatPostinganRingkas($p));

        return $this->suksesDaftar('Daftar postingan berhasil diambil', $data, $this->buildMeta($paginator));
    }

    // ─────────────────────────────────────────────
    // §10.2  POST /forum/postingan
    // ─────────────────────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'judul' => 'required|string|max:255',
            'isi'   => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->errorValidasi($validator->errors()->toArray());
        }

        $review = Review::create([
            'user_id' => $request->user()->id,
            'judul'   => $request->judul,
            'isi'     => $request->isi,
        ]);

        $review->load('penulis');
        $review->loadCount('balasan as jumlah_balasan');

        return $this->sukses('Postingan berhasil dibuat', $this->formatPostinganRingkas($review), 201);
    }

    // ─────────────────────────────────────────────
    // §10.3  GET /forum/postingan/{id}
    // ─────────────────────────────────────────────
    public function show(int $id): JsonResponse
    {
        $review = Review::with('penulis')
            ->withCount('balasan as jumlah_balasan')
            ->find($id);

        if (! $review) {
            return $this->error('Postingan tidak ditemukan', 'NOT_FOUND', 404);
        }

        return $this->sukses('Detail postingan berhasil diambil', [
            'id'             => $review->id,
            'judul'          => $review->judul,
            'isi'            => $review->isi,
            'penulis'        => $this->formatPenulis($review->penulis),
            'tanggal'        => $review->created_at->toIso8601ZuluString(),
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $review = Review::find($id);

        if (! $review) {
            return $this->error('Postingan tidak ditemukan', 'NOT_FOUND', 404);
        }

        if ($request->user()->id !== $review->user_id) {
            return $this->error('Anda tidak memiliki izin untuk mengubah postingan ini', 'FORBIDDEN', 403);
        }

        $validator = Validator::make($request->all(), [
            'judul' => 'required|string|max:255',
            'isi'   => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->errorValidasi($validator->errors()->toArray());
        }

        $review->update([
            'judul' => $request->judul,
            'isi'   => $request->isi,
        ]);

        return $this->sukses('Postingan berhasil diperbarui', [
            'id'             => $review->id,
            'judul'          => $review->judul,
            'isi'            => $review->isi,
            'penulis'        => $this->formatPenulis($review->penulis),
            'tanggal'        => $review->created_at->toIso8601ZuluString(),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $review = Review::find($id);

        if (! $review) {
            return $this->error('Postingan tidak ditemukan', 'NOT_FOUND', 404);
        }

        if ($request->user()->id !== $review->user_id) {
            return $this->error('Anda tidak memiliki izin untuk menghapus postingan ini', 'FORBIDDEN', 403);
        }

        $review->delete();
        return $this->sukses('Postingan berhasil dihapus', null, 200);

    }

    // ─────────────────────────────────────────────
    // §10.4  GET /forum/postingan/{id}/balasan
    // sort: tanggal (default tanggal = terlama dulu)
    // ─────────────────────────────────────────────

    // ─────────────────────────────────────────────
    // Helper: format postingan ringkas (§4.6)
    // ringkasan = 150 karakter pertama isi
    // ─────────────────────────────────────────────
    private function formatPostinganRingkas(Review $review): array
    {
        $isi       = $review->isi ?? '';
        $ringkasan = mb_strlen($isi) > 150 ? mb_substr($isi, 0, 150) . '…' : $isi;

        return [
            'id'             => $review->id,
            'judul'          => $review->judul,
            'ringkasan'      => $ringkasan,
            'penulis'        => $this->formatPenulis($review->penulis),
            'tanggal'        => $review->created_at->toIso8601ZuluString(),
        ];
    }

    // ─────────────────────────────────────────────
    // Helper: format penulis ringkas (§4.2)
    // ─────────────────────────────────────────────
    private function formatPenulis($user): array
    {
        return [
            'id'   => $user->id,
            'nama' => $user->nama,
            'role' => $user->role,
        ];
    }
}
