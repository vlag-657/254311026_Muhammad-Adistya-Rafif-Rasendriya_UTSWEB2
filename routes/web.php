<?php

use Illuminate\Support\Facades\Route;

Route::view('/', 'welcome');
Route::view('/{path}', 'welcome')
    ->where('path', '^(login|register|artikel(/.*)?|kuis(/.*)?|hasil-kuis(/.*)?|forum(/.*)?|profil|admin(/.*)?|review(\/.*)?)$');