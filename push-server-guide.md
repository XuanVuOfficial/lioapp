# Hướng dẫn gửi Push Notification khi tắt màn hình (Android/iOS)

Để tính năng thông báo hoạt động **ngay cả khi người dùng đã tắt màn hình hoặc đóng thẻ trình duyệt** (đặc biệt trên Android và iOS PWA), bạn cần gửi một "Push Message" thông qua Firebase Cloud Messaging (FCM). 

Frontend của PWA (Service Worker) chỉ có thể lắng nghe thông báo này dưới nền. Còn việc **Gửi** thông báo bắt buộc phải được thực hiện thông qua Server/Backend.

Trong ứng dụng, mã nguồn đã tự động lưu `FCM Token` của từng nhân viên vào trong Firebase Realtime Database tại đường dẫn: `fcmTokens/[email_duoc_thay_the_dau_cham_bang_gach_duoi]` (ví dụ: `xuan_vu_official@gmail_com`).

## Cách thiết lập gửi Push Message bằng PHP

Do bạn đang chạy backend PHP (`query.php` tại `app.xuanvu.click`), bạn có thể thêm một đoạn code nhỏ bằng PHP sử dụng **Google Service Account** để lấy Token từ Realtime Database và gửi thông báo FCM.

### Bước 1: Lấy Firebase Service Account
1. Truy cập [Firebase Console](https://console.firebase.google.com/) -> Dự án của bạn.
2. Vào **Project Settings** (Cài đặt dự án) -> **Service accounts** (Tài khoản dịch vụ).
3. Bấm **Generate new private key** (Tạo khóa riêng tư mới) và lưu file JSON này lại (ví dụ đổi tên thành `service-account.json`).
4. Tải file này lên server PHP của bạn (Bảo mật: không để public file này).

### Bước 2: Viết script PHP gửi thông báo

Sau khi thực hiện gán khách hàng (chia Lead) thành công trong `query.php`, bạn có thể thực thi đoạn code sau để gửi push notification tới người nhận:

```php
<?php
// Function Gửi Push Notification sử dụng Firebase HTTP v1 API
function sendFCMNotification($userEmail, $title, $body) {
    // 1. Kết nối Firebase Realtime Database bằng REST API để lấy FCM Token
    $dbUrl = 'https://untitled1-b15a7-default-rtdb.firebaseio.com';
    $encodedEmail = str_replace('.', '_', $userEmail);
    
    // Lấy FCM Token từ RTDB
    $tokenJson = file_get_contents("$dbUrl/fcmTokens/$encodedEmail.json");
    $fcmToken = json_decode($tokenJson, true);
    
    if (!$fcmToken) {
        return "User hasn't registered for notifications.";
    }

    // 2. Sinh OAuth 2.0 Access Token từ service-account.json 
    // Yêu cầu thư viện google-api-php-client: "composer require google/apiclient"
    // Nếu bạn không dùng composer, tham khảo các cách tạo JWT cho Google API bằng PHP thuần.
    require_once 'vendor/autoload.php';
    
    $client = new Google_Client();
    $client->setAuthConfig('path/to/service-account.json');
    $client->addScope('https://www.googleapis.com/auth/firebase.messaging');
    
    $client->fetchAccessTokenWithAssertion();
    $accessToken = $client->getAccessToken()['access_token'];
    
    // 3. Gửi thông báo tới Firebase FCM HTTP v1 API
    $projectId = "untitled1-b15a7";
    $url = "https://fcm.googleapis.com/v1/projects/$projectId/messages:send";
    
    $message = [
        "message" => [
            "token" => $fcmToken,
            "notification" => [
                "title" => $title,
                "body" => $body,
            ],
            // Data payload optional
            "data" => [
                "url" => "/"
            ]
        ]
    ];
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array(
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ));
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($message));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return $response;
}

// Cách gọi khi update Lead:
// sendFCMNotification('nguyenvana@gmail.com', 'Khách hàng mới', 'Bạn vừa được chia 1 khách hàng mới!');
?>
```

### Cách đơn giản hơn nếu không dùng PHP (Firebase Cloud Functions)
Nếu bạn không muốn thiết lập phía PHP, bạn có thể triển khai một function ngay trên Firebase (Yêu cầu tài khoản Firebase nâng cấp gói Blaze - miễn phí mức cơ bản) để lắng nghe sự thay đổi của một collection/database và tự động gửi Push Message.

### Lưu ý cho Progressive Web App (PWA) trên iOS
Trên iOS (iPhone/iPad), tính năng gửi Web Push Notification ở chế độ nền chỉ hoạt động đối với iOS bản 16.4 trở lên **VÀ** người dùng bắt buộc phải **Thêm ứng dụng vào Màn hình chính** (Add to Home Screen) thông qua Safari thì mới có thể xin được quyền thông báo.
