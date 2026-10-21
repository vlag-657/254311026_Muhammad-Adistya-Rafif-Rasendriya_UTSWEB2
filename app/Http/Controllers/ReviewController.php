<?php

namespace App\Http\Controllers;

use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ReviewController extends Controller
{
    // ─────────────────────────────────────────────
    // GET /api/v1/review (atau /review/post)
    // ─────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->query(), [
            'q'     => 'nullable|string|max:100',
            'sort'  => 'nullable|string|in:dibuat_pada,-dibuat_pada,tanggal,-tanggal',
            'page'  => 'nullable|integer|min:1',
            'limit' => 'nullable|integer|min:1|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $page = $request->query('page', 1);
        $limit = $request->query('limit', 9);
        $sort = $request->query('sort', '-created_at');
        $search = $request->query('q');

        $query = Review::with('penulis');

        if (!empty($search)) {
            $query->where('judul', 'like', '%' . $search . '%')
                  ->orWhere('isi', 'like', '%' . $search . '%');
        }

        // Tentukan arah sorting
        $sortField = str_contains($sort, 'tanggal') ? 'created_at' : 'created_at';
        $sortDirection = str_starts_with($sort, '-') ? 'desc' : 'asc';
        
        $query->orderBy($sortField, $sortDirection);

        $paginator = $query->paginate($limit, ['*'], 'page', $page);

        // Format data agar sesuai dengan yang dibaca oleh app.js
        $formattedData = $paginator->getCollection()->map(function ($review) {
            return [
                'id'          => $review->id,
                'judul'       => $review->judul,
                'isi'         => $review->isi, // Kirim isi lengkap atau buat ringkasan
                'dibuat_pada' => $review->created_at->toIso8601ZuluString(),
                'penulis'     => $this->formatPenulis($review->penulis),
            ];
        });

        return response()->json([
            'data' => $formattedData,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page'    => $paginator->lastPage(),
                'per_page'     => $paginator->perPage(),
                'total'        => $paginator->total(),
            ]
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'judul' => 'required|string|max:255',
            'isi'   => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $review = Review::create([
            'user_id' => $request->user()->id,
            'judul'   => $request->judul,
            'isi'     => $request->isi,
        ]);

        $review->load('penulis');

        return response()->json([
            'message' => 'Review berhasil dibuat',
            'data'    => [
                'id'          => $review->id,
                'judul'       => $review->judul,
                'isi'         => $review->isi,
                'dibuat_pada' => $review->created_at->toIso8601ZuluString(),
                'penulis'     => $this->formatPenulis($review->penulis),
            ]
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $review = Review::with('penulis')->find($id);

        if (!$review) {
            return response()->json(['message' => 'Review tidak ditemukan'], 404);
        }

        return response()->json([
            'data' => [
                'id'          => $review->id,
                'judul'       => $review->judul,
                'isi'         => $review->isi,
                'dibuat_pada' => $review->created_at->toIso8601ZuluString(),
                'penulis'     => $this->formatPenulis($review->penulis),
            ]
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $review = Review::find($id);

        if (!$review) {
            return response()->json(['message' => 'Review tidak ditemukan'], 404);
        }

        if ($request->user()->id !== $review->user_id) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        $validator = Validator::make($request->all(), [
            'judul' => 'required|string|max:255',
            'isi'   => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validasi gagal', 'errors' => $validator->errors()], 422);
        }

        $review->update([
            'judul' => $request->judul,
            'isi'   => $request->isi,
        ]);

        return response()->json([
            'message' => 'Review berhasil diperbarui',
            'data'    => [
                'id'          => $review->id,
                'judul'       => $review->judul,
                'isi'         => $review->isi,
                'dibuat_pada' => $review->created_at->toIso8601ZuluString(),
                'penulis'     => $this->formatPenulis($review->penulis),
            ]
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $review = Review::find($id);

        if (!$review) {
            return response()->json(['message' => 'Review tidak ditemukan'], 404);
        }

        if ($request->user()->id !== $review->user_id) {
            return response()->json(['message' => 'Akses ditolak'], 403);
        }

        $review->delete();

        return response()->json(['message' => 'Review berhasil dihapus']);
    }

    private function formatPenulis($user): array
    {
        if (!$user) return ['id' => null, 'nama' => 'Pengguna', 'role' => 'user'];
        return [
            'id'   => $user->id,
            'nama' => $user->nama ?? $user->name ?? 'Pengguna',
            'role' => $user->role ?? 'user',
        ];
    }
}