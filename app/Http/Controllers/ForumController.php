<?php

namespace App\Http\Controllers;

use App\Models\Balasan;
use App\Models\Postingan;
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
class ForumController extends Controller
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
        $query = Postingan::with('penulis')->withCount('balasan as jumlah_balasan');

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

        $postingan = Postingan::create([
            'user_id' => $request->user()->id,
            'judul'   => $request->judul,
            'isi'     => $request->isi,
        ]);

        $postingan->load('penulis');
        $postingan->loadCount('balasan as jumlah_balasan');

        return $this->sukses('Postingan berhasil dibuat', $this->formatPostinganRingkas($postingan), 201);
    }

    // ─────────────────────────────────────────────
    // §10.3  GET /forum/postingan/{id}
    // ─────────────────────────────────────────────
    public function show(int $id): JsonResponse
    {
        $postingan = Postingan::with('penulis')
            ->withCount('balasan as jumlah_balasan')
            ->find($id);

        if (! $postingan) {
            return $this->error('Postingan tidak ditemukan', 'NOT_FOUND', 404);
        }

        return $this->sukses('Detail postingan berhasil diambil', [
            'id'             => $postingan->id,
            'judul'          => $postingan->judul,
            'isi'            => $postingan->isi,
            'penulis'        => $this->formatPenulis($postingan->penulis),
            'jumlah_balasan' => $postingan->jumlah_balasan,
            'tanggal'        => $postingan->created_at->toIso8601ZuluString(),
        ]);
    }

    public function delete(int $id): JsonResponse
    {
         $postingan = Postingan::with('penulis')
            ->withCount('balasan as jumlah_balasan')
            ->find($id);
            
        if (! $postingan) {
            return $this->error('Postingan tidak ditemukan', 'NOT_FOUND', 404);
        }



        // Hanya penulis postingan atau admin yang dapat menghapus postingan
        if ($postingan->user_id !== auth()->id() && auth()->user()->role !== 'admin') {
            return $this->error('Anda tidak memiliki izin untuk menghapus postingan ini', 'FORBIDDEN', 403);
        }

        $postingan->delete();

        return $this->sukses('Postingan berhasil dihapus', null, 200);
    }
    // ─────────────────────────────────────────────
    // §10.4  GET /forum/postingan/{id}/balasan
    // sort: tanggal (default tanggal = terlama dulu)
    // ─────────────────────────────────────────────
    public function balasan(Request $request, int $id): JsonResponse
    {
        $postingan = Postingan::find($id);
        if (! $postingan) {
            return $this->error('Postingan tidak ditemukan', 'NOT_FOUND', 404);
        }

        $params = $this->paginasiParams($request);
        if ($params === null) {
            return $this->errorValidasi([
                'page'  => ['Nilai page harus >= 1'],
                'limit' => ['Nilai limit harus antara 1 dan 50'],
            ]);
        }

        $validator = Validator::make($request->query(), [
            'sort' => 'nullable|string|in:tanggal,-tanggal',
        ]);
        if ($validator->fails()) {
            return $this->errorValidasi($validator->errors()->toArray());
        }

        $sort      = $request->query('sort', 'tanggal');
        $paginator = Balasan::with('penulis')
            ->where('postingan_id', $id)
            ->orderBy('created_at', str_starts_with($sort, '-') ? 'desc' : 'asc')
            ->paginate($params['limit'], ['*'], 'page', $params['page']);

        $data = $paginator->getCollection()->map(fn ($b) => [
            'id'           => $b->id,
            'postingan_id' => $b->postingan_id,
            'isi'          => $b->isi,
            'penulis'      => $this->formatPenulis($b->penulis),
            'tanggal'      => $b->created_at->toIso8601ZuluString(),
        ]);

        return $this->suksesDaftar('Daftar balasan berhasil diambil', $data, $this->buildMeta($paginator));
    }

    // ─────────────────────────────────────────────
    // §10.5  POST /forum/postingan/{id}/balasan
    // ─────────────────────────────────────────────
    public function balas(Request $request, int $id): JsonResponse
    {
        $postingan = Postingan::find($id);
        if (! $postingan) {
            return $this->error('Postingan tidak ditemukan', 'NOT_FOUND', 404);
        }

        $validator = Validator::make($request->all(), [
            'isi' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->errorValidasi($validator->errors()->toArray());
        }

        $balasan = Balasan::create([
            'postingan_id' => $id,
            'user_id'      => $request->user()->id,
            'isi'          => $request->isi,
        ]);

        $balasan->load('penulis');

        return $this->sukses('Balasan berhasil dibuat', [
            'id'           => $balasan->id,
            'postingan_id' => $balasan->postingan_id,
            'isi'          => $balasan->isi,
            'penulis'      => $this->formatPenulis($balasan->penulis),
            'tanggal'      => $balasan->created_at->toIso8601ZuluString(),
        ], 201);
    }

    // ─────────────────────────────────────────────
    // Helper: format postingan ringkas (§4.6)
    // ringkasan = 150 karakter pertama isi
    // ─────────────────────────────────────────────
    private function formatPostinganRingkas(Postingan $postingan): array
    {
        $isi       = $postingan->isi ?? '';
        $ringkasan = mb_strlen($isi) > 150 ? mb_substr($isi, 0, 150) . '…' : $isi;

        return [
            'id'             => $postingan->id,
            'judul'          => $postingan->judul,
            'ringkasan'      => $ringkasan,
            'penulis'        => $this->formatPenulis($postingan->penulis),
            'jumlah_balasan' => $postingan->jumlah_balasan ?? 0,
            'tanggal'        => $postingan->created_at->toIso8601ZuluString(),
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
