import Foundation
import UserNotifications

func describe(_ status: UNAuthorizationStatus) -> String {
    switch status {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    case .provisional: return "provisional"
    case .ephemeral: return "provisional"
    @unknown default: return "notDetermined"
    }
}

let center = UNUserNotificationCenter.current()
let arguments = CommandLine.arguments
let command = arguments.count > 1 ? arguments[1] : "status"
let finished = DispatchSemaphore(value: 0)
var answer = "notDetermined"

func report() {
    center.getNotificationSettings { settings in
        answer = describe(settings.authorizationStatus)
        finished.signal()
    }
}

func post() {
    let content = UNMutableNotificationContent()
    content.title = arguments.count > 2 ? arguments[2] : ""
    content.body = arguments.count > 3 ? arguments[3] : ""
    if !(arguments.count > 4 && arguments[4] == "silent") {
        content.sound = .default
    }
    let request = UNNotificationRequest(
        identifier: UUID().uuidString,
        content: content,
        trigger: nil
    )
    center.add(request) { error in
        answer = error == nil ? "posted" : "failed"
        finished.signal()
    }
}

switch command {
case "request":
    center.requestAuthorization(options: [.alert, .sound]) { _, _ in
        report()
    }
case "post":
    post()
default:
    report()
}

_ = finished.wait(timeout: .now() + 60)
print(answer)
exit(0)
