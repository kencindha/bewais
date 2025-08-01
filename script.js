document.addEventListener('DOMContentLoaded', function() {
    // Data dummy untuk grafik kecelakaan kapal berdasarkan jenis
    const dummyData = {
        labels: ['Kapal Kargo', 'Kapal Penumpang', 'Kapal Nelayan'],
        datasets: [{
            label: 'Jumlah Kecelakaan',
            data: [15, 7, 12], // Contoh jumlah kecelakaan
            backgroundColor: [
                'rgba(255, 99, 132, 0.6)',
                'rgba(54, 162, 235, 0.6)',
                'rgba(255, 206, 86, 0.6)'
            ],
            borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)'
            ],
            borderWidth: 1
        }]
    };

    // Ambil elemen canvas dari HTML
    const ctx = document.getElementById('shipAccidentChart').getContext('2d');

    // Buat grafik baru
    const shipAccidentChart = new Chart(ctx, {
        type: 'bar', // Jenis grafik: bar (batang)
        data: {
            labels: dummyData.labels,
            datasets: dummyData.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Jumlah Insiden'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Jenis Kapal'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${context.raw} insiden`;
                        }
                    }
                }
            }
        }
    });
});