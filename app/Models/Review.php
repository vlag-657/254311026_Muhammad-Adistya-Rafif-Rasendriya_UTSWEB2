<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    protected $table = 'review';
    protected $fillable = ['user_id', 'judul', 'isi'];
 
    public function penulis() { return $this->belongsTo(User::class, 'user_id'); }
}