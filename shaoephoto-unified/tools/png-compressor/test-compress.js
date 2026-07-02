/**
 * PNG压缩功能测试脚本
 * 在浏览器控制台中运行此脚本
 */

// 测试用例
var testCases = [
    {
        name: '简单8色图像',
        width: 100,
        height: 100,
        colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000']
    },
    {
        name: '复杂256色图像',
        width: 200,
        height: 200,
        colors: Array.from({length: 256}, (_, i) => '#' + ((1 << 24) + (i << 16) + (i << 8) + i).toString(16).slice(1))
    },
    {
        name: '带透明度的图像',
        width: 100,
        height: 100,
        colors: ['#ff000080', '#00ff0080', '#0000ff80', '#ffff0080'],
        hasAlpha: true
    }
];

// 运行测试
function runTests() {
    console.log('=== PNG压缩功能测试 ===\n');

    testCases.forEach(function(testCase, index) {
        console.log('测试 ' + (index + 1) + ': ' + testCase.name);

        // 创建测试图像
        var canvas = document.createElement('canvas');
        canvas.width = testCase.width;
        canvas.height = testCase.height;
        var ctx = canvas.getContext('2d');

        // 绘制测试图像
        for (var y = 0; y < testCase.height; y++) {
            for (var x = 0; x < testCase.width; x++) {
                var colorIndex = (x + y) % testCase.colors.length;
                ctx.fillStyle = testCase.colors[colorIndex];
                ctx.fillRect(x, y, 1, 1);
            }
        }

        // 获取图像数据
        var imageData = ctx.getImageData(0, 0, testCase.width, testCase.height);

        // 测试量化
        console.log('  量化测试...');
        var quantResult = PngCompressor._quantizeToPalette(
            imageData.data,
            256,
            testCase.width,
            testCase.height
        );
        console.log('  量化结果: ' + quantResult.palette.length + ' 种颜色');

        // 测试PNG-8编码
        console.log('  PNG-8编码测试...');
        PngCompressor._encodePNG8Async(
            testCase.width,
            testCase.height,
            quantResult,
            function(blob) {
                if (blob && blob.size > 0) {
                    console.log('  ✓ PNG-8编码成功: ' + blob.size + ' 字节');

                    // 与原始PNG比较
                    canvas.toBlob(function(originalBlob) {
                        var ratio = Math.round((1 - blob.size / originalBlob.size) * 100);
                        console.log('  原始大小: ' + originalBlob.size + ' 字节');
                        console.log('  压缩后: ' + blob.size + ' 字节');
                        console.log('  压缩率: ' + ratio + '%');
                        console.log('  测试结果: ' + (ratio > 0 ? '通过' : '失败'));
                        console.log('');
                    }, 'image/png');
                } else {
                    console.log('  ✗ PNG-8编码失败: blob为空或大小为0');
                    console.log('');
                }
            }
        );
    });
}

// 检查PngCompressor是否已加载
if (typeof PngCompressor !== 'undefined') {
    runTests();
} else {
    console.log('请先加载PNG压缩工具页面，然后运行此脚本');
}
