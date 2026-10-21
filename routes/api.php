<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\ArtikelController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ForumController;
use App\Http\Controllers\HasilKuisController;
use App\Http\Controllers\KuisController;
use App\Http\Controllers\ProfilController;
use App\Http\Controllers\ReviewController;
use App\Http\views\reviewindex\indexreview;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ---- Publik ----
    Route::prefix('auth')->middleware('throttle:10,1')->group(function () {
        Route::post('register', [AuthController::class, 'register']);
        Route::post('login',    [AuthController::class, 'login']);
        Route::post('refresh',  [AuthController::class, 'refresh']);
        Route::get('review', [ReviewController::class, 'index']);
    });

    Route::get('artikel',      [ArtikelController::class, 'index']);
    Route::get('artikel/{id}', [ArtikelController::class, 'show']);

    // ---- Harus login (user & admin) ----
    Route::middleware('auth:sanctum')->group(function () {

        Route::post('auth/logout', [AuthController::class, 'logout']);

        Route::get('profil',          [ProfilController::class, 'show']);
        Route::put('profil',          [ProfilController::class, 'update']);
        Route::put('profil/password', [ProfilController::class, 'ubahPassword']);

        Route::get('kuis',            [KuisController::class, 'index']);
        Route::get('kuis/{id}',       [KuisController::class, 'show']);
        Route::get('hasil-kuis/{id}', [HasilKuisController::class, 'show']);

        Route::get('forum/postingan',               [ForumController::class, 'index']);
        Route::post('forum/postingan',              [ForumController::class, 'store']);
        Route::get('forum/postingan/{id}',          [ForumController::class, 'show']);
        Route::get('forum/postingan/{id}/balasan',  [ForumController::class, 'balasan']);
        Route::post('forum/postingan/{id}/balasan', [ForumController::class, 'balas']);

        Route::get('review',           [ReviewController::class, 'index']);
        Route::post('review',          [ReviewController::class, 'store']);
        Route::get('review/{id}',      [ReviewController::class, 'show']);
        Route::put('review/{id}',      [ReviewController::class, 'update']);
        Route::delete('review/{id}',   [ReviewController::class, 'destroy']);

        // ---- User saja ----
        Route::middleware('role:user')->group(function () {
            Route::post('kuis/{id}/percobaan', [KuisController::class, 'kerjakan']);
            Route::get('hasil-kuis',           [HasilKuisController::class, 'index']);
        });

        // ---- Admin saja ----
        Route::middleware('role:admin')->prefix('admin')->group(function () {

            Route::post('artikel',        [Admin\ArtikelController::class, 'store']);
            Route::put('artikel/{id}',    [Admin\ArtikelController::class, 'update']);
            Route::delete('artikel/{id}', [Admin\ArtikelController::class, 'destroy']);

            Route::get('kuis',         [Admin\KuisController::class, 'index']);
            Route::get('kuis/{id}',    [Admin\KuisController::class, 'show']);
            Route::post('kuis',        [Admin\KuisController::class, 'store']);
            Route::put('kuis/{id}',    [Admin\KuisController::class, 'update']);
            Route::delete('kuis/{id}', [Admin\KuisController::class, 'destroy']);
            Route::post('kuis/{id}/pertanyaan',                   [Admin\KuisController::class, 'tambahPertanyaan']);
            Route::put('kuis/{id}/pertanyaan/{pertanyaan_id}',    [Admin\KuisController::class, 'ubahPertanyaan']);
            Route::delete('kuis/{id}/pertanyaan/{pertanyaan_id}', [Admin\KuisController::class, 'hapusPertanyaan']);
            Route::get('kuis/{id}/hasil',                         [Admin\KuisController::class, 'hasil']);

            Route::get('forum/postingan',         [Admin\ForumController::class, 'index']);
            Route::delete('forum/postingan/{id}', [Admin\ForumController::class, 'hapusPostingan']);
            Route::delete('forum/balasan/{id}',   [Admin\ForumController::class, 'hapusBalasan']);

            Route::get('pengguna',      [Admin\PenggunaController::class, 'index']);
            Route::get('pengguna/{id}', [Admin\PenggunaController::class, 'show']);
        });
    });
});