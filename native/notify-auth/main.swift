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
let command = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "status"
let finished = DispatchSemaphore(value: 0)
var answer = "notDetermined"

func report() {
    center.getNotificationSettings { settings in
        answer = describe(settings.authorizationStatus)
        finished.signal()
    }
}

if command == "request" {
    center.requestAuthorization(options: [.alert, .sound]) { _, _ in
        report()
    }
} else {
    report()
}

_ = finished.wait(timeout: .now() + 20)
print(answer)
exit(0)
