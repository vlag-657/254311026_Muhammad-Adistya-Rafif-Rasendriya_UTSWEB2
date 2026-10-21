@extends('views.review')

@section('content')
    <div class="container">
        <h1 class="mb-4">Daftar Review</h1>

        <!-- Tombol Tambah Data -->
        <div class="mb-3">
            <a href="{{ route('reviews.store') }}" class="btn btn-success">Tambah Review Baru</a>
        </div>

        <!-- Form Pencarian -->
        <form action="{{ route('shuttles.index') }}" method="GET">
            <div class="input-group mb-3">
                <input type="text" class="form-control" name="search" placeholder="Cari review..." value="{{ request()->search }}">
                <button class="btn btn-primary" type="submit">Cari</button>
            </div>
        </form>

        <!-- Tabel Data Review -->
        <table class="table table-bordered table-striped">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nama Review</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>
                @forelse ($shuttles as $shuttle)
                    <tr>
                        <td>{{ $shuttle->id }}</td>
                        <td>{{ $shuttle->nama_armada }}</td>
                        <td>
                            <a href="{{ route('shuttles.show', $shuttle->id) }}" class="btn btn-info btn-sm">Detail</a>
                            <a href="{{ route('shuttles.edit', $shuttle->id) }}" class="btn btn-warning btn-sm">Edit</a>
                            
                            <!-- Form Delete -->
                            <form action="{{ route('shuttles.destroy', $shuttle->id) }}" method="POST" class="d-inline">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="btn btn-danger btn-sm" onclick="return confirm('Yakin ingin menghapus?')">Hapus</button>
                            </form>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="3" class="text-center">Data review tidak ditemukan.</td>
                    </tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection