//
//  Item.swift
//  gym-app
//
//  Created by Stefan Apostolovski on 8.7.26.
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    
    init(timestamp: Date) {
        self.timestamp = timestamp
    }
}
